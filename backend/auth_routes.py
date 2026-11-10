"""
FastAPI Authentication & User Profile Routes.
Endpoints for registration, login, profile telemetry, and submission history.
"""

from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, EmailStr, Field

from database import get_db
from auth import hash_password, verify_password, create_access_token, require_current_user

router = APIRouter(prefix="/api", tags=["Authentication & Profile"])

# Request Schemas
class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=30)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)

class LoginRequest(BaseModel):
    username_or_email: str
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    solved_problems: List[str]
    created_at: datetime

@router.post("/auth/register")
async def register(req: RegisterRequest):
    """Registers a new user account with a hashed password."""
    db = get_db()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is currently unavailable. Please verify MONGO_URI in .env."
        )

    # Check for existing email or username
    existing_user = await db.users.find_one({
        "$or": [
            {"email": req.email.lower()},
            {"username": req.username}
        ]
    })
    if existing_user:
        if existing_user.get("email") == req.email.lower():
            raise HTTPException(status_code=400, detail="An account with this email already exists.")
        raise HTTPException(status_code=400, detail="Username is already taken.")

    # Create user document
    new_user = {
        "username": req.username,
        "email": req.email.lower(),
        "password_hash": hash_password(req.password),
        "solved_problems": [],
        "created_at": datetime.now(timezone.utc)
    }

    result = await db.users.insert_one(new_user)
    user_id = str(result.inserted_id)

    # Issue JWT token
    token = create_access_token({"sub": user_id, "username": req.username})

    return {
        "token": token,
        "user": {
            "id": user_id,
            "username": req.username,
            "email": req.email.lower(),
            "solved_problems": []
        }
    }

@router.post("/auth/login")
async def login(req: LoginRequest):
    """Authenticates user credentials and issues a signed JWT token."""
    db = get_db()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is currently unavailable."
        )

    identifier = req.username_or_email.strip().lower()

    # Find by email or username
    user = await db.users.find_one({
        "$or": [
            {"email": identifier},
            {"username": req.username_or_email.strip()}
        ]
    })

    if not user or not verify_password(req.password, user.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username/email or password."
        )

    user_id = str(user["_id"])
    token = create_access_token({"sub": user_id, "username": user["username"]})

    return {
        "token": token,
        "user": {
            "id": user_id,
            "username": user["username"],
            "email": user["email"],
            "solved_problems": user.get("solved_problems", [])
        }
    }

@router.get("/auth/me")
async def get_profile(current_user: dict = Depends(require_current_user)):
    """Returns the authenticated user's profile and solved problem list."""
    return {
        "id": current_user["id"],
        "username": current_user["username"],
        "email": current_user["email"],
        "solved_problems": current_user.get("solved_problems", []),
        "solved_count": len(current_user.get("solved_problems", []))
    }

@router.get("/submissions/my")
async def get_my_submissions(current_user: dict = Depends(require_current_user)):
    """Returns the recent submissions made by the authenticated user."""
    db = get_db()
    if db is None:
        return []

    cursor = db.submissions.find({"user_id": current_user["id"]}).sort("created_at", -1).limit(20)
    submissions = []
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        submissions.append(doc)

    return submissions

