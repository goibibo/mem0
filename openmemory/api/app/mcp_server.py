"""
MCP Server for OpenMemory with resilient memory client handling.

This module implements an MCP (Model Context Protocol) server that provides
memory operations for OpenMemory. The memory client is initialized lazily
to prevent server crashes when external dependencies (like Ollama) are
unavailable. If the memory client cannot be initialized, the server will
continue running with limited functionality and appropriate error messages.

Key features:
- Lazy memory client initialization
- Graceful error handling for unavailable dependencies
- Fallback to database-only mode when vector store is unavailable
- Proper logging for debugging connection issues
- Environment variable parsing for API keys
"""

import contextvars
import datetime
import json
import logging
import uuid
from typing import Optional

from app.database import SessionLocal
from app.models import Memory, MemoryAccessLog, MemoryState, MemoryStatusHistory
from app.utils.db import get_user_and_app
from app.utils.memory import get_memory_client
from app.utils.permissions import check_memory_access_permissions
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.routing import APIRouter
from mcp.server.fastmcp import FastMCP
from mcp.server.sse import SseServerTransport
from qdrant_client import models as qdrant_models

# Load environment variables
load_dotenv()

# Initialize MCP
mcp = FastMCP("mem0-mcp-server")

# Don't initialize memory client at import time - do it lazily when needed
def get_memory_client_safe():
    """Get memory client with error handling. Returns None if client cannot be initialized."""
    try:
        return get_memory_client()
    except Exception as e:
        logging.warning(f"Failed to get memory client: {e}")
        return None

# Context variables for user_id and client_name
user_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("user_id")
client_name_var: contextvars.ContextVar[str] = contextvars.ContextVar("client_name")

# Create a router for MCP endpoints
mcp_router = APIRouter(prefix="/mcp")

# Initialize SSE transport
sse = SseServerTransport("/mcp/messages/")

@mcp.tool(description="""Add a new memory to store information about the user, their preferences, or any relevant data.

Parameters:
- text (required): The memory content to store. This should be clear, concise information about the user.
- user_id (optional): The ID of the user. If not provided, will use the current session user.
- metadata (optional): A dictionary of custom key-value pairs to associate with this memory. 
  Examples: {"category": "preference", "topic": "food", "importance": "high"}
  
This method should be called when:
- The user shares personal information or preferences
- The user explicitly asks to remember something
- You learn something significant about the user that would be useful in future conversations
""")
async def add_memories(text: str, user_id: str = "", metadata: Optional[dict] = None) -> str:
    uid = user_id_var.get(None) or user_id
    client_name = client_name_var.get(None)
    logging.info(f"Adding memory: {text} for user: {uid} and client: {client_name}")

    if not uid or uid == "":
        return "Error: user_id not provided"
    if not client_name:
        return "Error: client_name not provided"

    # Get memory client safely
    memory_client = get_memory_client_safe()
    if not memory_client:
        return "Error: Memory system is currently unavailable. Please try again later."

    try:
        db = SessionLocal()
        try:
            # Get or create user and app
            user, app = get_user_and_app(db, user_id=uid, app_id=client_name)
            logging.info(f"User: {user.name} and app: {app.name}")

            # Check if app is active
            if not app.is_active:
                return f"Error: Client/Agent {app.name} is currently paused on OpenMemory. Cannot create new memories."

            # Merge custom metadata with default metadata
            memory_metadata = {
                "source_app": "openmemory",
                "mcp_client": client_name,
            }
            if metadata:
                memory_metadata.update(metadata)

            response = memory_client.add(text,
                                         user_id=uid,
                                         agent_id=app.name,
                                         metadata=memory_metadata)

            # Process the response and update database
            if isinstance(response, dict) and 'results' in response:
                for result in response['results']:
                    memory_id = uuid.UUID(result['id'])
                    memory = db.query(Memory).filter(Memory.id == memory_id).first()

                    if result['event'] == 'ADD':
                        if not memory:
                            memory = Memory(
                                id=memory_id,
                                user_id=user.id,
                                app_id=app.id,
                                content=result['memory'],
                                metadata_=memory_metadata,
                                state=MemoryState.active
                            )
                            db.add(memory)
                            logging.info(f"Memory: {str(memory)} added to database")
                        else:
                            memory.state = MemoryState.active
                            memory.content = result['memory']
                            memory.metadata_ = memory_metadata

                        # Create history entry
                        history = MemoryStatusHistory(
                            memory_id=memory_id,
                            changed_by=user.id,
                            old_state=MemoryState.deleted if memory else None,
                            new_state=MemoryState.active
                        )
                        db.add(history)

                    elif result['event'] == 'DELETE':
                        if memory:
                            memory.state = MemoryState.deleted
                            memory.deleted_at = datetime.datetime.now(datetime.UTC)
                            # Create history entry
                            history = MemoryStatusHistory(
                                memory_id=memory_id,
                                changed_by=user.id,
                                old_state=MemoryState.active,
                                new_state=MemoryState.deleted
                            )
                            db.add(history)

                db.commit()

            return str(response)
        finally:
            db.close()
    except Exception as e:
        logging.exception(f"Error adding to memory: {e}")
        return f"Error adding to memory: {e}"


@mcp.tool(description="""Search through stored memories using natural language queries.

Parameters:
- query (required): The search query in natural language. Be specific about what you're looking for.
- user_id (optional): The ID of the user whose memories to search. If not provided, will use the current session user.

Returns: A JSON array of matching memories, each containing:
- id: The memory ID
- memory: The memory content
- score: Relevance score (higher is more relevant)
- metadata: Any custom metadata associated with the memory
- created_at/updated_at: Timestamps

This method should be called EVERY TIME the user asks a question to retrieve relevant context.
""")
async def search_memory(query: str, user_id: str = "") -> str:
    uid = user_id_var.get(None) or user_id
    client_name = client_name_var.get(None)
    logging.info(f"Searching memory: {query} for user: {uid} and client: {client_name}")
    if not uid or uid == "":
        return "Error: user_id not provided"
    if not client_name:
        return "Error: client_name not provided"

    # Get memory client safely
    memory_client = get_memory_client_safe()
    if not memory_client:
        return "Error: Memory system is currently unavailable. Please try again later."

    try:
        db = SessionLocal()
        try:
            # Get or create user and app
            user, app = get_user_and_app(db, user_id=uid, app_id=client_name)

            # Get accessible memory IDs based on ACL
            user_memories = db.query(Memory).filter(Memory.user_id == user.id).all()
            accessible_memory_ids = [memory.id for memory in user_memories if check_memory_access_permissions(db, memory, app.id)]
            
            conditions = [qdrant_models.FieldCondition(key="user_id", match=qdrant_models.MatchValue(value=uid))]
            
            if accessible_memory_ids:
                # Convert UUIDs to strings for Qdrant
                accessible_memory_ids_str = [str(memory_id) for memory_id in accessible_memory_ids]
                conditions.append(qdrant_models.HasIdCondition(has_id=accessible_memory_ids_str))

            filters = qdrant_models.Filter(must=conditions)
            embeddings = memory_client.embedding_model.embed(query, "search")
            
            hits = memory_client.vector_store.client.query_points(
                collection_name=memory_client.vector_store.collection_name,
                query=embeddings,
                query_filter=filters,
                limit=10,
            )

            # Process search results
            memories = hits.points
            memories = [
                {
                    "id": memory.id,
                    "memory": memory.payload["data"],
                    "hash": memory.payload.get("hash"),
                    "created_at": memory.payload.get("created_at"),
                    "updated_at": memory.payload.get("updated_at"),
                    "score": memory.score,
                }
                for memory in memories
            ]

            # Enrich memories with metadata from database
            enriched_memories = []
            for memory in memories:
                memory_id = uuid.UUID(memory['id'])
                db_memory = db.query(Memory).filter(Memory.id == memory_id).first()
                if db_memory:
                    memory['metadata'] = db_memory.metadata_ or {}
                enriched_memories.append(memory)
            memories = enriched_memories

            # Log memory access for each memory found
            if isinstance(memories, dict) and 'results' in memories:
                print(f"Memories: {memories}")
                for memory_data in memories['results']:
                    if 'id' in memory_data:
                        memory_id = uuid.UUID(memory_data['id'])
                        # Create access log entry
                        access_log = MemoryAccessLog(
                            memory_id=memory_id,
                            app_id=app.id,
                            access_type="search",
                            metadata_={
                                "query": query,
                                "score": memory_data.get('score'),
                                "hash": memory_data.get('hash')
                            }
                        )
                        db.add(access_log)
                db.commit()
            else:
                for memory in memories:
                    memory_id = uuid.UUID(memory['id'])
                    # Create access log entry
                    access_log = MemoryAccessLog(
                        memory_id=memory_id,
                        app_id=app.id,
                        access_type="search",
                        metadata_={
                            "query": query,
                            "score": memory.get('score'),
                            "hash": memory.get('hash')
                        }
                    )
                    db.add(access_log)
                db.commit()
            return json.dumps(memories, indent=2)
        finally:
            db.close()
    except Exception as e:
        logging.exception(e)
        return f"Error searching memory: {e}"


@mcp.tool(description="""List all memories stored for a user.

Parameters:
- user_id (optional): The ID of the user whose memories to list. If not provided, will use the current session user.

Returns: A JSON array of all accessible memories, each containing:
- id: The memory ID
- memory: The memory content
- metadata: Any custom metadata associated with the memory
- hash: Content hash for deduplication
- created_at/updated_at: Timestamps

Use this to get a complete overview of what information is stored about a user.
""")
async def list_memories(user_id: str = "") -> str:
    uid = user_id_var.get(None) or user_id
    client_name = client_name_var.get(None)
    logging.info(f"Listing memories for user: {uid} and client: {client_name}")
    if not uid or uid == "":
        return "Error: user_id not provided"
    if not client_name:
        return "Error: client_name not provided"

    # Get memory client safely
    memory_client = get_memory_client_safe()
    if not memory_client:
        return "Error: Memory system is currently unavailable. Please try again later."

    try:
        db = SessionLocal()
        try:
            # Get or create user and app
            user, app = get_user_and_app(db, user_id=uid, app_id=client_name)

            # Get all memories
            memories = memory_client.get_all(user_id=uid)
            filtered_memories = []

            # Filter memories based on permissions
            user_memories = db.query(Memory).filter(Memory.user_id == user.id).all()
            accessible_memory_ids = [memory.id for memory in user_memories if check_memory_access_permissions(db, memory, app.id)]
            memory_id_to_metadata = {memory.id: memory.metadata_ for memory in user_memories}
            
            if isinstance(memories, dict) and 'results' in memories:
                for memory_data in memories['results']:
                    if 'id' in memory_data:
                        memory_id = uuid.UUID(memory_data['id'])
                        if memory_id in accessible_memory_ids:
                            # Add metadata from database
                            memory_data['metadata'] = memory_id_to_metadata.get(memory_id, {}) or {}
                            
                            # Create access log entry
                            access_log = MemoryAccessLog(
                                memory_id=memory_id,
                                app_id=app.id,
                                access_type="list",
                                metadata_={
                                    "hash": memory_data.get('hash')
                                }
                            )
                            db.add(access_log)
                            filtered_memories.append(memory_data)
                db.commit()
            else:
                for memory in memories:
                    memory_id = uuid.UUID(memory['id'])
                    memory_obj = db.query(Memory).filter(Memory.id == memory_id).first()
                    if memory_obj and check_memory_access_permissions(db, memory_obj, app.id):
                        # Add metadata from database
                        memory['metadata'] = memory_obj.metadata_ or {}
                        
                        # Create access log entry
                        access_log = MemoryAccessLog(
                            memory_id=memory_id,
                            app_id=app.id,
                            access_type="list",
                            metadata_={
                                "hash": memory.get('hash')
                            }
                        )
                        db.add(access_log)
                        filtered_memories.append(memory)
                db.commit()
            return json.dumps(filtered_memories, indent=2)
        finally:
            db.close()
    except Exception as e:
        logging.exception(f"Error getting memories: {e}")
        return f"Error getting memories: {e}"


@mcp.tool(description="""Delete all memories for a user. USE WITH CAUTION - this action cannot be undone.

Parameters:
- user_id (optional): The ID of the user whose memories to delete. If not provided, will use the current session user.

Returns: A confirmation message if successful, or an error message if the operation fails.

This should only be called when explicitly requested by the user.
""")
async def delete_all_memories(user_id: str = "") -> str:
    uid = user_id_var.get(None) or user_id
    client_name = client_name_var.get(None)
    logging.info(f"Deleting all memories for user: {uid} and client: {client_name}")
    if not uid or uid == "":
        return "Error: user_id not provided"
    if not client_name:
        return "Error: client_name not provided"

    # Get memory client safely
    memory_client = get_memory_client_safe()
    if not memory_client:
        return "Error: Memory system is currently unavailable. Please try again later."

    try:
        memory_client.delete_all(user_id=uid)
        return "All memories deleted"
    except Exception as e:
        logging.exception(e)
        return f"Error deleting memories: {e}"


@mcp.tool(description="""Search memories with advanced filtering capabilities including metadata filters.

Parameters:
- query (required): The search query in natural language. Be specific about what you're looking for.
- user_id (optional): The ID of the user whose memories to search. If not provided, will use the current session user.
- metadata_filters (optional): A dictionary of key-value pairs to filter memories by metadata.
  Example: {"category": "preference", "topic": "food"} will only return memories with matching metadata.

Returns: A JSON array of matching memories sorted by relevance, each containing:
- id: The memory ID
- memory: The memory content  
- score: Relevance score (higher is more relevant)
- metadata: Custom metadata associated with the memory
- created_at/updated_at: Timestamps

Use this for advanced searches when you need to filter by specific metadata attributes.
""")
async def search_memories(query: str, user_id: str = "", metadata_filters: Optional[dict] = None) -> str:
    uid = user_id_var.get(None) or user_id
    client_name = client_name_var.get(None)
    logging.info(f"Searching memories with filters: {query} for user: {uid} and client: {client_name}, filters: {metadata_filters}")
    
    if not uid or uid == "":
        return "Error: user_id not provided"
    if not client_name:
        return "Error: client_name not provided"

    # Get memory client safely
    memory_client = get_memory_client_safe()
    if not memory_client:
        return "Error: Memory system is currently unavailable. Please try again later."

    try:
        db = SessionLocal()
        try:
            # Get or create user and app
            user, app = get_user_and_app(db, user_id=uid, app_id=client_name)

            # First, get all user memories and filter by metadata if needed
            query_filter = db.query(Memory).filter(
                Memory.user_id == user.id,
                Memory.state == MemoryState.active
            )
            
            # Apply metadata filters if provided
            if metadata_filters:
                # Filter memories that match all metadata criteria
                memories_with_metadata = []
                all_memories = query_filter.all()
                for memory in all_memories:
                    if check_memory_access_permissions(db, memory, app.id):
                        # Check if all metadata filters match
                        if memory.metadata_:
                            match = True
                            for key, value in metadata_filters.items():
                                if key not in memory.metadata_ or memory.metadata_[key] != value:
                                    match = False
                                    break
                            if match:
                                memories_with_metadata.append(memory)
                        elif not metadata_filters:  # Empty filter matches memories without metadata
                            memories_with_metadata.append(memory)
                
                accessible_memory_ids = [memory.id for memory in memories_with_metadata]
            else:
                # No metadata filter, just permission check
                user_memories = query_filter.all()
                accessible_memory_ids = [memory.id for memory in user_memories if check_memory_access_permissions(db, memory, app.id)]
            
            if not accessible_memory_ids:
                return json.dumps([], indent=2)
            
            # Now perform vector search on the filtered memories
            conditions = [
                qdrant_models.FieldCondition(key="user_id", match=qdrant_models.MatchValue(value=uid)),
                qdrant_models.HasIdCondition(has_id=[str(memory_id) for memory_id in accessible_memory_ids])
            ]
            
            filters = qdrant_models.Filter(must=conditions)
            embeddings = memory_client.embedding_model.embed(query, "search")
            
            hits = memory_client.vector_store.client.query_points(
                collection_name=memory_client.vector_store.collection_name,
                query=embeddings,
                query_filter=filters,
                limit=20,
            )

            # Process search results
            memories = hits.points
            result_memories = []
            
            for memory in memories:
                memory_id = uuid.UUID(memory.id)
                db_memory = db.query(Memory).filter(Memory.id == memory_id).first()
                
                memory_data = {
                    "id": memory.id,
                    "memory": memory.payload["data"],
                    "hash": memory.payload.get("hash"),
                    "created_at": memory.payload.get("created_at"),
                    "updated_at": memory.payload.get("updated_at"),
                    "score": memory.score,
                    "metadata": db_memory.metadata_ or {} if db_memory else {}
                }
                result_memories.append(memory_data)
                
                # Create access log entry
                access_log = MemoryAccessLog(
                    memory_id=memory_id,
                    app_id=app.id,
                    access_type="search",
                    metadata_={
                        "query": query,
                        "score": memory_data.get('score'),
                        "hash": memory_data.get('hash'),
                        "metadata_filters": metadata_filters
                    }
                )
                db.add(access_log)
            
            db.commit()
            return json.dumps(result_memories, indent=2)
        finally:
            db.close()
    except Exception as e:
        logging.exception(e)
        return f"Error searching memories: {e}"


@mcp_router.get("/{client_name}/sse/{user_id}")
async def handle_sse(request: Request):
    """Handle SSE connections for a specific user and client"""

    # Extract user_id and client_name from path parameters
    uid = request.path_params.get("user_id")
    user_token = user_id_var.set(uid or "")
    client_name = request.path_params.get("client_name")
    client_token = client_name_var.set(client_name or "")

    logging.info(f"Initialising client {client_name} and user {uid} specific MCP connection")

    try:
        # Handle SSE connection
        async with sse.connect_sse(
            request.scope,
            request.receive,
            request._send,
        ) as (read_stream, write_stream):
            await mcp._mcp_server.run(
                read_stream,
                write_stream,
                mcp._mcp_server.create_initialization_options(),
            )
    finally:
        # Clean up context variables
        user_id_var.reset(user_token)
        client_name_var.reset(client_token)

@mcp_router.get("/{client_name}/sse")
async def handle_sse(request: Request):
    """Handle SSE connections for a specific client"""
    
    # Extract user_id and client_name from path parameters
    client_name = request.path_params.get("client_name")
    client_token = client_name_var.set(client_name or "")

    logging.info(f"Initialising client {client_name} specific MCP connection")

    try:
        # Handle SSE connection
        async with sse.connect_sse(
            request.scope,
            request.receive,
            request._send,
        ) as (read_stream, write_stream):
            await mcp._mcp_server.run(
                read_stream,
                write_stream,
                mcp._mcp_server.create_initialization_options(),
            )
    finally:
        # Clean up context variables
        client_name_var.reset(client_token)


@mcp_router.post("/messages/")
async def handle_get_message(request: Request):
    return await handle_post_message(request)


@mcp_router.post("/{client_name}/sse/{user_id}/messages/")
async def handle_post_message(request: Request):
    return await handle_post_message(request)

@mcp_router.post("/{client_name}/sse/messages/")
async def handle_post_message(request: Request):
    return await handle_post_message(request)


async def handle_post_message(request: Request):
    """Handle POST messages for SSE"""
    try:
        body = await request.body()

        # Create a simple receive function that returns the body
        async def receive():
            return {"type": "http.request", "body": body, "more_body": False}

        # Create a simple send function that does nothing
        async def send(message):
            return {}

        # Call handle_post_message with the correct arguments
        await sse.handle_post_message(request.scope, receive, send)

        # Return a success response
        return {"status": "ok"}
    finally:
        pass

def setup_mcp_server(app: FastAPI):
    """Setup MCP server with the FastAPI application"""
    mcp._mcp_server.name = "mem0-mcp-server"

    # Include MCP router in the FastAPI app
    app.include_router(mcp_router)
