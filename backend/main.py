"""
FastAPI Application Entry Point.

Endpoints:
1. POST /api/submissions -> Ingests code submission, enqueues it, returns submission_id.
2. GET  /api/submissions/{id}/stream -> Real-time Server-Sent Events (SSE) telemetry.
3. GET  /api/health -> Cluster health and active workers.
"""

import sys
import uuid
import json
import asyncio
from contextlib import asynccontextmanager

# On Windows, asyncio requires ProactorEventLoop to support subprocess creation
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from queue_manager import queue_manager
from problems import PROBLEMS_DB

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Launch background worker consumer tasks
    queue_manager.start_workers()
    yield

app = FastAPI(title="CodeArena Remote Execution Engine", lifespan=lifespan)

# Allow Cross-Origin Requests from Next.js (port 3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SubmissionRequest(BaseModel):
    problem_id: str
    language: str
    code: str
    only_first_case: bool = False

@app.post("/api/submissions")
async def submit_code(req: SubmissionRequest):
    """
    Ingests user submission, pushes it to the worker queue,
    and returns a unique submission_id immediately without blocking.
    """
    if req.language not in ["python", "javascript", "cpp"]:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {req.language}")

    submission_id = f"sub_{uuid.uuid4().hex[:8]}"

    job_data = {
        "submission_id": submission_id,
        "problem_id": req.problem_id,
        "language": req.language,
        "code": req.code,
        "only_first_case": req.only_first_case
    }

    await queue_manager.enqueue_submission(job_data)

    return {
        "submission_id": submission_id,
        "status": "QUEUED",
        "queue_depth": queue_manager.queue_depth,
        "message": "Submission enqueued. Connect to /api/submissions/{id}/stream to follow execution."
    }

@app.get("/api/submissions/{submission_id}/stream")
async def stream_submission(submission_id: str):
    """
    Streams testcase execution events, stdout, and telemetry back to client via SSE.
    """
    async def event_generator():
        async for event in queue_manager.get_event_stream(submission_id):
            yield {
                "event": "message",
                "data": json.dumps(event)
            }

    return EventSourceResponse(event_generator())

@app.get("/api/health")
async def health_check():
    """Returns cluster telemetry for the frontend navbar."""
    return {
        "status": "healthy",
        "workers_active": queue_manager.worker_count,
        "queue_depth": queue_manager.queue_depth
    }

if __name__ == "__main__":
    import uvicorn
    loop_arg = "asyncio"
    if sys.platform == "win32":
        loop_arg = asyncio.ProactorEventLoop
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True, loop=loop_arg)

@app.get("/", include_in_schema=False)
async def root():
    """
    Simple health‑check / welcome endpoint.
    """
    return {"message": "PulseOps AI backend is running. Visit /docs for the API UI."}
