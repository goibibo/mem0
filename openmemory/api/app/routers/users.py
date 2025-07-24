from app.database import get_db
from app.models import User, Memory, MemoryState
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/v1/users", tags=["users"])

class CreateUserRequest(BaseModel):
    user_id: str
    name: Optional[str] = None
    email: Optional[str] = None

@router.get("/")
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """Get all users with their memory counts"""
    # Create a subquery for memory counts
    memory_counts = db.query(
        Memory.user_id,
        func.count(Memory.id).label('memory_count')
    ).filter(
        Memory.state != MemoryState.deleted
    ).group_by(Memory.user_id).subquery()
    
    # Base query
    query = db.query(
        User,
        func.coalesce(memory_counts.c.memory_count, 0).label('total_memories')
    ).outerjoin(
        memory_counts,
        User.id == memory_counts.c.user_id
    ).order_by(User.user_id)
    
    total = query.count()
    users = query.offset((page - 1) * page_size).limit(page_size).all()
    
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "users": [
            {
                "id": user[0].id,
                "user_id": user[0].user_id,
                "name": user[0].name,
                "email": user[0].email,
                "total_memories": user[1],
                "created_at": user[0].created_at
            }
            for user in users
        ]
    }

@router.post("/")
async def create_user(
    request: CreateUserRequest,
    db: Session = Depends(get_db)
):
    """Create a new user"""
    # Check if user already exists
    existing_user = db.query(User).filter(User.user_id == request.user_id).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists")
    
    # Check if email is already taken
    if request.email:
        existing_email = db.query(User).filter(User.email == request.email).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already taken")
    
    # Create new user
    new_user = User(
        user_id=request.user_id,
        name=request.name,
        email=request.email
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {
        "id": new_user.id,
        "user_id": new_user.user_id,
        "name": new_user.name,
        "email": new_user.email,
        "created_at": new_user.created_at
    } 