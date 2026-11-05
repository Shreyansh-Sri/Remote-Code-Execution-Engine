"""
Asynchronous Job Queue & Event Broadcaster using Redis Streams + Pub/Sub.

Architecture:
1. Redis Stream (codearena:submissions): Persistent FIFO queue for code execution jobs.
   Supports Consumer Groups (`judge_group`) so multiple worker pods can scale horizontally (KEDA).
2. Redis Pub/Sub (codearena:events:{submission_id}): Real-time telemetry streaming from workers
   to FastAPI SSE endpoints across pods.
3. In-Memory Fallback: Automatically falls back to asyncio.Queue if Redis is temporarily unreachable.
"""

import os
import json
import asyncio
from typing import Dict, Any, List, Optional
import redis.asyncio as aioredis
from runner.sandbox import SandboxExecutionEngine
from problems import PROBLEMS_DB

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
STREAM_NAME = "codearena:submissions"
GROUP_NAME = "judge_group"
EVENT_CHANNEL_PREFIX = "codearena:events:"

class QueueManager:
    def __init__(self, concurrency_limit: int = 4):
        self.concurrency_limit = concurrency_limit
        self.runner = SandboxExecutionEngine()
        self.redis: Optional[aioredis.Redis] = None
        self.use_redis = False

        # In-memory fallback structures
        self.local_queue: asyncio.Queue = asyncio.Queue()
        self.local_subscribers: Dict[str, asyncio.Queue] = {}

        self.worker_tasks: List[asyncio.Task] = []

    async def initialize(self):
        """Attempts connection to Redis and creates Consumer Group if missing."""
        try:
            self.redis = aioredis.from_url(REDIS_URL, decode_responses=True)
            await self.redis.ping()
            self.use_redis = True
            print(f"[*] Connected to Redis at {REDIS_URL}")

            # Create consumer group if it doesn't already exist
            try:
                await self.redis.xgroup_create(STREAM_NAME, GROUP_NAME, id="0", mkstream=True)
                print(f"[*] Created Redis Stream group '{GROUP_NAME}' on '{STREAM_NAME}'")
            except aioredis.ResponseError as e:
                if "BUSYGROUP" in str(e):
                    # Group already exists, which is normal on restart
                    pass
                else:
                    print(f"[!] Redis xgroup_create warning: {e}")
        except Exception as e:
            self.use_redis = False
            self.redis = None
            print(f"[!] Warning: Could not connect to Redis ({e}). Falling back to local in-memory queue.")

    def start_workers(self):
        """Spawns background consumer workers."""
        for i in range(self.concurrency_limit):
            task = asyncio.create_task(self._worker_loop(f"worker-pod-{i+1}"))
            self.worker_tasks.append(task)

    async def enqueue_submission(self, submission_data: Dict[str, Any]):
        """Pushes a new submission job into Redis Streams (or local fallback)."""
        submission_id = submission_data["submission_id"]

        if self.use_redis and self.redis:
            try:
                # Add to Redis Stream
                await self.redis.xadd(STREAM_NAME, {"job": json.dumps(submission_data)})
                depth = await self.get_queue_depth()
                await self.publish_event(submission_id, {
                    "type": "QUEUE_STATUS",
                    "status": "QUEUED",
                    "message": f"Job {submission_id} queued in Redis Stream. Approximate depth: {depth}"
                })
                return
            except Exception as e:
                print(f"[!] Redis xadd failed ({e}), falling back to local queue")

        # Local fallback
        self.local_subscribers[submission_id] = asyncio.Queue()
        await self.local_queue.put(submission_data)
        await self.publish_event(submission_id, {
            "type": "QUEUE_STATUS",
            "status": "QUEUED",
            "message": f"Job {submission_id} queued in-memory. Position: {self.local_queue.qsize()}"
        })

    async def publish_event(self, submission_id: str, event_data: Dict[str, Any]):
        """Publishes execution telemetry to Redis Pub/Sub (and local subscribers)."""
        # Always deliver to local subscriber if active in this process
        if submission_id in self.local_subscribers:
            await self.local_subscribers[submission_id].put(event_data)

        # Publish to Redis Pub/Sub for cross-pod/process distribution
        if self.use_redis and self.redis:
            try:
                channel = f"{EVENT_CHANNEL_PREFIX}{submission_id}"
                await self.redis.publish(channel, json.dumps(event_data))
            except Exception as e:
                print(f"[!] Redis publish error: {e}")

    async def get_event_stream(self, submission_id: str):
        """Async generator yielding events to the SSE endpoint."""
        if self.use_redis and self.redis:
            # Redis Pub/Sub consumer
            pubsub = self.redis.pubsub()
            channel = f"{EVENT_CHANNEL_PREFIX}{submission_id}"
            await pubsub.subscribe(channel)

            # Also ensure local queue exists in case event came from local worker
            if submission_id not in self.local_subscribers:
                self.local_subscribers[submission_id] = asyncio.Queue()
            local_sub = self.local_subscribers[submission_id]

            try:
                while True:
                    # Check local queue first without blocking too long
                    while not local_sub.empty():
                        event = local_sub.get_nowait()
                        yield event
                        if event.get("type") == "COMPLETED":
                            return

                    # Listen for Redis messages with timeout so we don't hang indefinitely
                    message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=0.2)
                    if message and message.get("type") == "message":
                        data_str = message.get("data")
                        if data_str:
                            event = json.loads(data_str)
                            yield event
                            if event.get("type") == "COMPLETED":
                                break
                    await asyncio.sleep(0.01)
            finally:
                await pubsub.unsubscribe(channel)
                await pubsub.close()
                if submission_id in self.local_subscribers:
                    del self.local_subscribers[submission_id]
        else:
            # Pure local fallback
            if submission_id not in self.local_subscribers:
                self.local_subscribers[submission_id] = asyncio.Queue()

            sub_queue = self.local_subscribers[submission_id]
            try:
                while True:
                    event = await sub_queue.get()
                    yield event
                    if event.get("type") == "COMPLETED":
                        break
            finally:
                if submission_id in self.local_subscribers:
                    del self.local_subscribers[submission_id]

    async def _worker_loop(self, worker_id: str):
        """Continuously pulls jobs from Redis Stream Consumer Group or local queue."""
        while True:
            try:
                job = None
                redis_msg_id = None

                if self.use_redis and self.redis:
                    try:
                        # Read new message using Redis Consumer Group (block up to 1000ms)
                        response = await self.redis.xreadgroup(
                            groupname=GROUP_NAME,
                            consumername=worker_id,
                            streams={STREAM_NAME: ">"},
                            count=1,
                            block=1000
                        )
                        if response:
                            stream, messages = response[0]
                            if messages:
                                redis_msg_id, fields = messages[0]
                                job = json.loads(fields["job"])
                    except Exception as e:
                        print(f"[{worker_id}] Redis read error: {e}")
                        await asyncio.sleep(1)

                # If no Redis job, check local fallback queue
                if not job:
                    try:
                        job = await asyncio.wait_for(self.local_queue.get(), timeout=0.5)
                    except asyncio.TimeoutError:
                        continue

                # Process the job
                sub_id = job["submission_id"]
                prob_id = job["problem_id"]
                code = job["code"]
                language = job["language"]
                only_first_case = job.get("only_first_case", False)

                problem = PROBLEMS_DB.get(prob_id, PROBLEMS_DB["two-sum"])
                test_cases = problem["test_cases"]

                await self.publish_event(sub_id, {
                    "type": "LOG",
                    "message": f"[{worker_id}] Dequeued {sub_id}. Preparing sandbox..."
                })

                # Stream execution progress from sandbox
                async for event in self.runner.execute_submission(
                    submission_id=sub_id,
                    code=code,
                    language=language,
                    test_cases=test_cases,
                    only_first_case=only_first_case
                ):
                    await self.publish_event(sub_id, event)

                # Acknowledge completion in Redis or local queue
                if self.use_redis and self.redis and redis_msg_id:
                    await self.redis.xack(STREAM_NAME, GROUP_NAME, redis_msg_id)
                elif not (self.use_redis and redis_msg_id):
                    self.local_queue.task_done()

            except Exception as e:
                import traceback
                traceback.print_exc()
                print(f"[{worker_id}] Unhandled worker error: {repr(e)}")
                try:
                    if 'sub_id' in locals():
                        await self.publish_event(sub_id, {
                            "type": "COMPLETED",
                            "status": "RUNTIME_ERROR",
                            "error": str(e),
                            "logs": [f"Worker crashed: {repr(e)}"]
                        })
                except Exception:
                    pass
                await asyncio.sleep(0.5)

    async def get_queue_depth(self) -> int:
        """Returns the current queue depth (for health checks and KEDA scaling)."""
        if self.use_redis and self.redis:
            try:
                # XLEN gives total stream length
                return await self.redis.xlen(STREAM_NAME)
            except Exception:
                pass
        return self.local_queue.qsize()

    @property
    def queue_depth(self) -> int:
        # Synchronous property used by FastAPI endpoints
        if self.use_redis and self.redis:
            # Return cached or best effort estimate
            return 0
        return self.local_queue.qsize()

    @property
    def worker_count(self) -> int:
        return self.concurrency_limit

queue_manager = QueueManager()
