import logging
from datetime import UTC, datetime
from typing import List, Optional, Set, Dict
from uuid import UUID

from app.database import get_db
from app.models import (
    AccessControl,
    App,
    Category,
    Memory,
    MemoryAccessLog,
    MemoryState,
    MemoryStatusHistory,
    User,
)
from app.schemas import MemoryResponse
from app.utils.memory import get_memory_client
from app.utils.permissions import check_memory_access_permissions
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from fastapi_pagination import Page, Params
from fastapi_pagination.ext.sqlalchemy import paginate as sqlalchemy_paginate
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from qdrant_client import models as qdrant_models

router = APIRouter(prefix="/api/v1/memories", tags=["memories"])


def get_memory_or_404(db: Session, memory_id: UUID) -> Memory:
    memory = db.query(Memory).filter(Memory.id == memory_id).first()
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    return memory


def update_memory_state(db: Session, memory_id: UUID, new_state: MemoryState, user_id: UUID):
    memory = get_memory_or_404(db, memory_id)
    old_state = memory.state

    # Update memory state
    memory.state = new_state
    if new_state == MemoryState.archived:
        memory.archived_at = datetime.now(UTC)
    elif new_state == MemoryState.deleted:
        memory.deleted_at = datetime.now(UTC)

    # Record state change
    history = MemoryStatusHistory(
        memory_id=memory_id,
        changed_by=user_id,
        old_state=old_state,
        new_state=new_state
    )
    db.add(history)
    db.commit()
    return memory


def get_accessible_memory_ids(db: Session, app_id: UUID) -> Set[UUID]:
    """
    Get the set of memory IDs that the app has access to based on app-level ACL rules.
    Returns all memory IDs if no specific restrictions are found.
    """
    # Get app-level access controls
    app_access = db.query(AccessControl).filter(
        AccessControl.subject_type == "app",
        AccessControl.subject_id == app_id,
        AccessControl.object_type == "memory"
    ).all()

    # If no app-level rules exist, return None to indicate all memories are accessible
    if not app_access:
        return None

    # Initialize sets for allowed and denied memory IDs
    allowed_memory_ids = set()
    denied_memory_ids = set()

    # Process app-level rules
    for rule in app_access:
        if rule.effect == "allow":
            if rule.object_id:  # Specific memory access
                allowed_memory_ids.add(rule.object_id)
            else:  # All memories access
                return None  # All memories allowed
        elif rule.effect == "deny":
            if rule.object_id:  # Specific memory denied
                denied_memory_ids.add(rule.object_id)
            else:  # All memories denied
                return set()  # No memories accessible

    # Remove denied memories from allowed set
    if allowed_memory_ids:
        allowed_memory_ids -= denied_memory_ids

    return allowed_memory_ids


# List all memories with filtering
@router.get("/", response_model=Page[MemoryResponse])
async def list_memories(
    user_id: str,
    app_id: Optional[UUID] = None,
    from_date: Optional[int] = Query(
        None,
        description="Filter memories created after this date (timestamp)",
        examples=[1718505600]
    ),
    to_date: Optional[int] = Query(
        None,
        description="Filter memories created before this date (timestamp)",
        examples=[1718505600]
    ),
    categories: Optional[str] = None,
    params: Params = Depends(),
    search_query: Optional[str] = None,
    sort_column: Optional[str] = Query(None, description="Column to sort by (memory, categories, app_name, created_at)"),
    sort_direction: Optional[str] = Query(None, description="Sort direction (asc or desc)"),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Build base query
    query = db.query(Memory).filter(
        Memory.user_id == user.id,
        Memory.state != MemoryState.deleted,
        Memory.state != MemoryState.archived,
        Memory.content.ilike(f"%{search_query}%") if search_query else True
    )

    # Apply filters
    if app_id:
        query = query.filter(Memory.app_id == app_id)

    if from_date:
        from_datetime = datetime.fromtimestamp(from_date, tz=UTC)
        query = query.filter(Memory.created_at >= from_datetime)

    if to_date:
        to_datetime = datetime.fromtimestamp(to_date, tz=UTC)
        query = query.filter(Memory.created_at <= to_datetime)

    # Add joins for app and categories after filtering
    query = query.outerjoin(App, Memory.app_id == App.id)
    query = query.outerjoin(Memory.categories)

    # Apply category filter if provided
    if categories:
        category_list = [c.strip() for c in categories.split(",")]
        query = query.filter(Category.name.in_(category_list))

    # Apply sorting if specified
    if sort_column:
        sort_field = getattr(Memory, sort_column, None)
        if sort_field:
            query = query.order_by(sort_field.desc()) if sort_direction == "desc" else query.order_by(sort_field.asc())


    # Get paginated results
    paginated_results = sqlalchemy_paginate(query, params)

    # Filter results based on permissions
    filtered_items = []
    for item in paginated_results.items:
        if check_memory_access_permissions(db, item, app_id):
            filtered_items.append(item)

    # Update paginated results with filtered items
    paginated_results.items = filtered_items
    paginated_results.total = len(filtered_items)

    return paginated_results


# Get all categories
@router.get("/categories")
async def get_categories(
    user_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    if user_id:
        # Get categories for specific user
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get unique categories associated with the user's memories
        memories = db.query(Memory).filter(
            Memory.user_id == user.id, 
            Memory.state != MemoryState.deleted, 
            Memory.state != MemoryState.archived
        ).all()
    else:
        # Get all categories from all users
        memories = db.query(Memory).filter(
            Memory.state != MemoryState.deleted, 
            Memory.state != MemoryState.archived
        ).all()
    
    # Get all categories from memories
    category_objects = []
    seen_category_ids = set()
    
    for memory in memories:
        for category in memory.categories:
            if category.id not in seen_category_ids:
                category_objects.append({
                    "id": str(category.id),
                    "name": category.name,
                    "description": category.description,
                    "created_at": category.created_at.isoformat(),
                    "updated_at": category.updated_at.isoformat()
                })
                seen_category_ids.add(category.id)

    return {
        "categories": category_objects,
        "total": len(category_objects)
    }


class CreateMemoryRequest(BaseModel):
    user_id: str
    text: str
    metadata: dict = {}
    infer: bool = True
    app: str = "openmemory"


# Create new memory
@router.post("/")
async def create_memory(
    request: CreateMemoryRequest,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.user_id == request.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Get or create app
    app_obj = db.query(App).filter(App.name == request.app,
                                   App.owner_id == user.id).first()
    if not app_obj:
        app_obj = App(name=request.app, owner_id=user.id)
        db.add(app_obj)
        db.commit()
        db.refresh(app_obj)

    # Check if app is active
    if not app_obj.is_active:
        raise HTTPException(status_code=403, detail=f"Client/Agent {request.app} is currently paused on OpenMemory. Cannot create new memories.")

    # Log what we're about to do
    logging.info(f"Creating memory for user_id: {request.user_id} with app: {request.app}")
    
    # Try to get memory client safely
    try:
        memory_client = get_memory_client()
        if not memory_client:
            raise Exception("Memory client is not available")
    except Exception as client_error:
        logging.warning(f"Memory client unavailable: {client_error}. Creating memory in database only.")
        # Return a json response with the error
        return {
            "error": str(client_error)
        }

    # Try to save to Qdrant via memory_client
    try:
        qdrant_response = memory_client.add(
            request.text,
            user_id=request.user_id,  # Use string user_id to match search
            metadata={
                "source_app": "openmemory",
                "mcp_client": request.app,
            }
        )
        
        # Log the response for debugging
        #logging.info(f"Qdrant response: {qdrant_response}")
        
        # Process Qdrant response
        if isinstance(qdrant_response, dict) and 'results' in qdrant_response:
            for result in qdrant_response['results']:
                if result['event'] == 'ADD':
                    # Get the Qdrant-generated ID
                    memory_id = UUID(result['id'])
                    
                    # Check if memory already exists
                    existing_memory = db.query(Memory).filter(Memory.id == memory_id).first()
                    
                    if existing_memory:
                        # Update existing memory
                        existing_memory.state = MemoryState.active
                        existing_memory.content = result['memory']
                        memory = existing_memory
                    else:
                        # Create memory with the EXACT SAME ID from Qdrant
                        memory = Memory(
                            id=memory_id,  # Use the same ID that Qdrant generated
                            user_id=user.id,
                            app_id=app_obj.id,
                            content=result['memory'],
                            metadata_=request.metadata,
                            state=MemoryState.active
                        )
                        db.add(memory)
                    
                    # Create history entry
                    history = MemoryStatusHistory(
                        memory_id=memory_id,
                        changed_by=user.id,
                        old_state=MemoryState.deleted if existing_memory else MemoryState.deleted,
                        new_state=MemoryState.active
                    )
                    db.add(history)
                    
                    db.commit()
                    db.refresh(memory)
                    return memory
    except Exception as qdrant_error:
        logging.warning(f"Qdrant operation failed: {qdrant_error}.")
        # Return a json response with the error
        return {
            "error": str(qdrant_error)
        }




# Get memory by ID
@router.get("/{memory_id}")
async def get_memory(
    memory_id: UUID,
    db: Session = Depends(get_db)
):
    memory = get_memory_or_404(db, memory_id)
    return {
        "id": memory.id,
        "text": memory.content,
        "created_at": int(memory.created_at.timestamp()),
        "state": memory.state.value,
        "app_id": memory.app_id,
        "app_name": memory.app.name if memory.app else None,
        "categories": [category.name for category in memory.categories],
        "metadata_": memory.metadata_
    }


class DeleteMemoriesRequest(BaseModel):
    memory_ids: List[UUID]
    user_id: str

# Delete multiple memories
@router.delete("/")
async def delete_memories(
    request: DeleteMemoriesRequest,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.user_id == request.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    deleted_count = 0
    vector_store_errors = []
    
    for memory_id in request.memory_ids:
        # Update database state to deleted
        update_memory_state(db, memory_id, MemoryState.deleted, user.id)
        
        # Delete from vector store
        try:
            memory_client = get_memory_client()
            if memory_client:
                memory_client.delete(str(memory_id))
                logging.info(f"Deleted memory {memory_id} from vector store")
            else:
                logging.warning("Memory client not available, skipping vector store deletion")
        except Exception as e:
            error_msg = f"Error deleting memory {memory_id} from vector store: {e}"
            logging.error(error_msg)
            vector_store_errors.append(error_msg)
        
        deleted_count += 1
    
    # Return response with information about any vector store errors
    response_message = f"Successfully deleted {deleted_count} memories from database"
    if vector_store_errors:
        response_message += f". Vector store errors: {len(vector_store_errors)} memories had issues"
        logging.warning(f"Vector store deletion errors: {vector_store_errors}")
    
    return {"message": response_message}


# Archive memories
@router.post("/actions/archive")
async def archive_memories(
    memory_ids: List[UUID],
    user_id: UUID,
    db: Session = Depends(get_db)
):
    for memory_id in memory_ids:
        update_memory_state(db, memory_id, MemoryState.archived, user_id)
    return {"message": f"Successfully archived {len(memory_ids)} memories"}


class PauseMemoriesRequest(BaseModel):
    memory_ids: Optional[List[UUID]] = None
    category_ids: Optional[List[UUID]] = None
    app_id: Optional[UUID] = None
    all_for_app: bool = False
    global_pause: bool = False
    state: Optional[MemoryState] = None
    user_id: str

# Pause access to memories
@router.post("/actions/pause")
async def pause_memories(
    request: PauseMemoriesRequest,
    db: Session = Depends(get_db)
):
    
    global_pause = request.global_pause
    all_for_app = request.all_for_app
    app_id = request.app_id
    memory_ids = request.memory_ids
    category_ids = request.category_ids
    state = request.state or MemoryState.paused

    user = db.query(User).filter(User.user_id == request.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_id = user.id
    
    if global_pause:
        # Pause all memories
        memories = db.query(Memory).filter(
            Memory.state != MemoryState.deleted,
            Memory.state != MemoryState.archived
        ).all()
        for memory in memories:
            update_memory_state(db, memory.id, state, user_id)
        return {"message": "Successfully paused all memories"}

    if app_id:
        # Pause all memories for an app
        memories = db.query(Memory).filter(
            Memory.app_id == app_id,
            Memory.user_id == user.id,
            Memory.state != MemoryState.deleted,
            Memory.state != MemoryState.archived
        ).all()
        for memory in memories:
            update_memory_state(db, memory.id, state, user_id)
        return {"message": f"Successfully paused all memories for app {app_id}"}
    
    if all_for_app and memory_ids:
        # Pause all memories for an app
        memories = db.query(Memory).filter(
            Memory.user_id == user.id,
            Memory.state != MemoryState.deleted,
            Memory.id.in_(memory_ids)
        ).all()
        for memory in memories:
            update_memory_state(db, memory.id, state, user_id)
        return {"message": "Successfully paused all memories"}

    if memory_ids:
        # Pause specific memories
        for memory_id in memory_ids:
            update_memory_state(db, memory_id, state, user_id)
        return {"message": f"Successfully paused {len(memory_ids)} memories"}

    if category_ids:
        # Pause memories by category
        memories = db.query(Memory).join(Memory.categories).filter(
            Category.id.in_(category_ids),
            Memory.state != MemoryState.deleted,
            Memory.state != MemoryState.archived
        ).all()
        for memory in memories:
            update_memory_state(db, memory.id, state, user_id)
        return {"message": f"Successfully paused memories in {len(category_ids)} categories"}

    raise HTTPException(status_code=400, detail="Invalid pause request parameters")


# Get memory access logs
@router.get("/{memory_id}/access-log")
async def get_memory_access_log(
    memory_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db)
):
    query = db.query(MemoryAccessLog).filter(MemoryAccessLog.memory_id == memory_id)
    total = query.count()
    logs = query.order_by(MemoryAccessLog.accessed_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    # Get app name
    for log in logs:
        app = db.query(App).filter(App.id == log.app_id).first()
        log.app_name = app.name if app else None

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "logs": logs
    }


class UpdateMemoryRequest(BaseModel):
    memory_content: str
    user_id: str

# Update a memory
@router.put("/{memory_id}")
async def update_memory(
    memory_id: UUID,
    request: UpdateMemoryRequest,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.user_id == request.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    memory = get_memory_or_404(db, memory_id)
    
    # Update database
    memory.content = request.memory_content
    memory.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(memory)
    
    # Update vector store
    try:
        memory_client = get_memory_client()
        if memory_client:
            # Get app name for vector store update
            app = db.query(App).filter(App.id == memory.app_id).first()
            app_name = app.name if app else "openmemory"
            
            # Update the memory in vector store
            memory_client.update(
                memory_id=str(memory_id),
                text=request.memory_content,
                metadata=memory.metadata_ or {}
            )
            logging.info(f"Updated memory {memory_id} in vector store")
        else:
            logging.warning("Memory client not available, skipping vector store update")
    except Exception as e:
        logging.error(f"Error updating memory {memory_id} in vector store: {e}")
        # Don't fail the request if vector store update fails
        # The database update was successful
    
    return memory

class FilterMemoriesRequest(BaseModel):
    user_id: Optional[str] = None  # Made optional for backward compatibility
    user_ids: Optional[List[str]] = None  # New field for multiple users
    page: int = 1
    size: int = 10
    search_query: Optional[str] = None
    app_ids: Optional[List[UUID]] = None
    app_names: Optional[List[str]] = None  # New field for filtering by app names
    category_ids: Optional[List[UUID]] = None
    metadata_filters: Optional[Dict[str, str]] = None
    sort_column: Optional[str] = None
    sort_direction: Optional[str] = None
    from_date: Optional[int] = None
    to_date: Optional[int] = None
    show_archived: Optional[bool] = False

@router.post("/filter", response_model=Page[MemoryResponse])
async def filter_memories(
    request: FilterMemoriesRequest,
    db: Session = Depends(get_db)
):
    # Handle user filtering
    user_ids_to_filter = []
    
    # Support both single user_id (backward compatibility) and multiple user_ids
    if request.user_id:
        user = db.query(User).filter(User.user_id == request.user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        user_ids_to_filter = [user.id]
    elif request.user_ids and len(request.user_ids) > 0:
        users = db.query(User).filter(User.user_id.in_(request.user_ids)).all()
        user_ids_to_filter = [user.id for user in users]
    else:
        # If no user specified, get all memories from all users
        user_ids_to_filter = None

    # Build base query
    query = db.query(Memory).filter(
        Memory.state != MemoryState.deleted,
    )
    
    # Apply user filter if specified
    if user_ids_to_filter is not None:
        query = query.filter(Memory.user_id.in_(user_ids_to_filter))

    # Filter archived memories based on show_archived parameter
    if not request.show_archived:
        query = query.filter(Memory.state != MemoryState.archived)

    # Apply search filter
    if request.search_query:
        query = query.filter(Memory.content.ilike(f"%{request.search_query}%"))

    # Apply app filter
    if request.app_ids and len(request.app_ids) > 0:
        query = query.filter(Memory.app_id.in_(request.app_ids))
    elif request.app_names and len(request.app_names) > 0:
        # Filter by app names using a subquery to get app IDs
        app_names_to_filter = [name.strip() for name in request.app_names]
        app_ids_subquery = db.query(App.id).filter(App.name.in_(app_names_to_filter)).subquery()
        query = query.filter(Memory.app_id.in_(app_ids_subquery))

    # Always join App table for app_name in response and potential sorting
    query = query.outerjoin(App, Memory.app_id == App.id)

    # Apply category filter
    if request.category_ids and len(request.category_ids) > 0:
        query = query.join(Memory.categories).filter(Category.id.in_(request.category_ids))
    else:
        query = query.outerjoin(Memory.categories)

    # Apply metadata filters
    if request.metadata_filters:
        for key, value in request.metadata_filters.items():
            query = query.filter(
                func.json_extract(Memory.metadata_, f'$.{key}') == value
            )

    # Apply date filters
    if request.from_date:
        from_datetime = datetime.fromtimestamp(request.from_date, tz=UTC)
        query = query.filter(Memory.created_at >= from_datetime)

    if request.to_date:
        to_datetime = datetime.fromtimestamp(request.to_date, tz=UTC)
        query = query.filter(Memory.created_at <= to_datetime)

    # Apply sorting
    if request.sort_column and request.sort_direction:
        sort_direction = request.sort_direction.lower()
        if sort_direction not in ['asc', 'desc']:
            raise HTTPException(status_code=400, detail="Invalid sort direction")

        sort_mapping = {
            'memory': Memory.content,
            'app_name': App.name,
            'created_at': Memory.created_at
        }

        if request.sort_column not in sort_mapping:
            raise HTTPException(status_code=400, detail="Invalid sort column")

        sort_field = sort_mapping[request.sort_column]
        if sort_direction == 'desc':
            query = query.order_by(sort_field.desc())
        else:
            query = query.order_by(sort_field.asc())
    else:
        # Default sorting
        query = query.order_by(Memory.created_at.desc())

    # Add eager loading for categories and user, and make the query distinct
    query = query.options(
        joinedload(Memory.categories),
        joinedload(Memory.user)
    ).distinct(Memory.id)

    # Use fastapi-pagination's paginate function
    return sqlalchemy_paginate(
        query,
        Params(page=request.page, size=request.size),
        transformer=lambda items: [
            MemoryResponse(
                id=memory.id,
                content=memory.content,
                created_at=memory.created_at,
                state=memory.state.value,
                app_id=memory.app_id,
                app_name=memory.app.name if memory.app else None,
                user_id=memory.user.user_id if memory.user else None,
                categories=[category.name for category in memory.categories],
                metadata_=memory.metadata_
            )
            for memory in items
        ]
    )


@router.get("/{memory_id}/related", response_model=Page[MemoryResponse])
async def get_related_memories(
    memory_id: UUID,
    user_id: str,
    params: Params = Depends(),
    db: Session = Depends(get_db)
):
    # Validate user
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get the source memory
    memory = get_memory_or_404(db, memory_id)
    
    # Extract category IDs from the source memory
    category_ids = [category.id for category in memory.categories]
    
    if not category_ids:
        return Page.create([], total=0, params=params)
    
    # Build query for related memories
    query = db.query(Memory).distinct(Memory.id).filter(
        Memory.user_id == user.id,
        Memory.id != memory_id,
        Memory.state != MemoryState.deleted
    ).join(Memory.categories).filter(
        Category.id.in_(category_ids)
    ).options(
        joinedload(Memory.categories),
        joinedload(Memory.app)
    ).order_by(
        func.count(Category.id).desc(),
        Memory.created_at.desc()
    ).group_by(Memory.id)
    
    # ⚡ Force page size to be 5
    params = Params(page=params.page, size=5)
    
    return sqlalchemy_paginate(
        query,
        params,
        transformer=lambda items: [
            MemoryResponse(
                id=memory.id,
                content=memory.content,
                created_at=memory.created_at,
                state=memory.state.value,
                app_id=memory.app_id,
                app_name=memory.app.name if memory.app else None,
                user_id=memory.user.user_id if memory.user else None,
                categories=[category.name for category in memory.categories],
                metadata_=memory.metadata_
            )
            for memory in items
        ]
    )

class SearchMemoriesRequest(BaseModel):
    query: str = Field(..., description="Natural language search query", example="What are the user's hobbies?")
    user_id: Optional[str] = Field(None, description="Single user ID to filter by", example="user123")
    user_ids: Optional[List[str]] = Field(None, description="Multiple user IDs to filter by", example=["user1", "user2"])
    limit: int = Field(10, description="Maximum number of results", ge=1, le=100)
    threshold: float = Field(0.3, description="Minimum relevance score (0-1)", ge=0.0, le=1.0)
    include_metadata: bool = Field(True, description="Include custom metadata in response")
    app_ids: Optional[List[UUID]] = Field(None, description="Filter by application IDs")
    app_names: Optional[List[str]] = Field(None, description="Filter by application names")


@router.post("/search", response_model=List[MemoryResponse])
async def search_memories(
    request: SearchMemoriesRequest,
    db: Session = Depends(get_db)
):
    """
    Search memories using vector search with natural language queries.
    Returns memories sorted by relevance score.
    
    Example request:
    {
        "query": "What are the user's favorite foods?",
        "user_id": "user123",
        "limit": 10,
        "threshold": 0.5
    }
    """
    try:
        # Get memory client
        memory_client = get_memory_client()
        if not memory_client:
            raise HTTPException(status_code=503, detail="Memory system is currently unavailable")
        
        logging.info(f"Memory client initialized successfully")
        logging.info(f"Vector store collection: {memory_client.vector_store.collection_name}")
        
        # Get users if specified
        target_user_ids = []
        if request.user_id:
            user = db.query(User).filter(User.user_id == request.user_id).first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            target_user_ids = [user.user_id]
        elif request.user_ids:
            users = db.query(User).filter(User.user_id.in_(request.user_ids)).all()
            target_user_ids = [user.user_id for user in users]
        
        # Build search conditions
        conditions = []
        
        # User filter
        if target_user_ids:
            if len(target_user_ids) == 1:
                conditions.append(qdrant_models.FieldCondition(
                    key="user_id", 
                    match=qdrant_models.MatchValue(value=target_user_ids[0])
                ))
            else:
                conditions.append(qdrant_models.FieldCondition(
                    key="user_id",
                    match=qdrant_models.MatchAny(any=target_user_ids)
                ))
        
        # App filter
        if request.app_ids:
            app_names = db.query(App.name).filter(App.id.in_(request.app_ids)).all()
            app_names = [name[0] for name in app_names]
            if app_names:
                conditions.append(qdrant_models.FieldCondition(
                    key="agent_id",
                    match=qdrant_models.MatchAny(any=app_names)
                ))
        elif request.app_names:
            # Filter by app names directly
            app_names_to_filter = [name.strip() for name in request.app_names]
            if app_names_to_filter:
                conditions.append(qdrant_models.FieldCondition(
                    key="agent_id",
                    match=qdrant_models.MatchAny(any=app_names_to_filter)
                ))
                logging.info(f"Applied agent_id filter in semantic search: {app_names_to_filter}")
        
        # Create filter if conditions exist
        filters = qdrant_models.Filter(must=conditions) if conditions else None
        
        logging.info(f"Searching for query: '{request.query}' with threshold: {request.threshold}")
        logging.info(f"Using filters: {filters}")
        logging.info(f"User filters: user_id={request.user_id}, user_ids={request.user_ids}")
        logging.info(f"App filters: app_ids={request.app_ids}, app_names={request.app_names}")
        
        # Generate embeddings for the query
        embeddings = memory_client.embedding_model.embed(request.query, "search")
        
        logging.info(f"Generated embeddings for query, vector dimension: {len(embeddings)}")
        
        # Perform vector search
        hits = memory_client.vector_store.client.query_points(
            collection_name=memory_client.vector_store.collection_name,
            query=embeddings,
            query_filter=filters,
            limit=request.limit,
            score_threshold=request.threshold
        )
        
        logging.info(f"Vector search returned {len(hits.points)} results with threshold {request.threshold}")
        logging.info(f"All hit scores: {[hit.score for hit in hits.points]}")
        logging.info(f"Hit IDs: {[hit.id for hit in hits.points]}")
        
        # Check if any hits are below threshold
        below_threshold = [hit for hit in hits.points if hit.score < request.threshold]
        if below_threshold:
            logging.warning(f"Found {len(below_threshold)} hits below threshold {request.threshold}: {[(hit.id, hit.score) for hit in below_threshold]}")
        
        # Process and enrich results
        result_memories = []
        for hit in hits.points:
            memory_id = UUID(hit.id)
            db_memory = db.query(Memory).options(
                joinedload(Memory.app),
                joinedload(Memory.user),
                joinedload(Memory.categories)
            ).filter(Memory.id == memory_id).first()
            
            if db_memory:
                # Include score in metadata for sorting/display
                memory_metadata = {}
                if request.include_metadata:
                    memory_metadata = db_memory.metadata_ or {}
                memory_metadata['relevance_score'] = hit.score
                
                # Log the relevance score for debugging
                logging.info(f"Memory '{db_memory.content[:50]}...' has relevance score: {hit.score}")
                
                memory_response = MemoryResponse(
                    id=db_memory.id,
                    content=hit.payload.get("data", db_memory.content),
                    user_id=db_memory.user.user_id,
                    app_id=db_memory.app_id,
                    app_name=db_memory.app.name,
                    metadata_=memory_metadata,
                    state=db_memory.state,
                    categories=[cat.name for cat in db_memory.categories],
                    created_at=db_memory.created_at
                )
                result_memories.append(memory_response)
        
        # Sort by relevance score (highest first)
        result_memories.sort(key=lambda m: m.metadata_.get('relevance_score', 0), reverse=True)
        
        logging.info(f"Search query '{request.query}' returned {len(result_memories)} results with threshold {request.threshold}")
        logging.info(f"Relevance scores: {[m.metadata_.get('relevance_score', 0) for m in result_memories]}")
        
        return result_memories
        
    except Exception as e:
        logging.error(f"Error searching memories: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error searching memories: {str(e)}")