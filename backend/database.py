"""
Database connection manager using Motor (Async MongoDB).
Manages MongoDB Atlas or local MongoDB connections, indexes, and collections.
"""

import os
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "")
DB_NAME = os.getenv("MONGO_DB_NAME", "codearena")

client: Optional[AsyncIOMotorClient] = None
db: Optional[AsyncIOMotorDatabase] = None

async def init_db():
    """Initializes MongoDB connection and creates required indexes."""
    global client, db
    if not MONGO_URI:
        print("[!] MONGO_URI not set. Running in memory / auth-mock mode.")
        return

    try:
        client = AsyncIOMotorClient(MONGO_URI)
        db = client[DB_NAME]
        # Ping database to confirm connection
        await client.admin.command('ping')
        print(f"[*] Successfully connected to MongoDB Atlas (Database: {DB_NAME})")

        # Create unique indexes for users
        await db.users.create_index("email", unique=True)
        await db.users.create_index("username", unique=True)

        # Index for user submissions lookup
        await db.submissions.create_index("user_id")
        await db.submissions.create_index([("created_at", -1)])
        print("[*] MongoDB indexes verified.")
    except Exception as e:
        print(f"[!] MongoDB Connection Error: {e}")
        db = None

async def close_db():
    """Closes MongoDB connection pool."""
    global client
    if client:
        client.close()
        print("[*] Closed MongoDB connection.")

def get_db() -> Optional[AsyncIOMotorDatabase]:
    return db

