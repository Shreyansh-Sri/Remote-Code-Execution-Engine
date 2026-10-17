"""
Asynchronous Job Queue & Event Broadcaster.

Simulates the behavior of Redis Streams + Pub/Sub using Python Asyncio Queues.
1. Holds submissions in an async FIFO Queue.
2. Background worker continuously pops submissions and runs them.
3. Broadcasts events to SSE subscribers waiting on `submission_id`.
"""

import asyncio
from typing import Dict, Any, List
from runner.sandbox import SandboxExecutionEngine
from problems import PROBLEMS_DB

class QueueManager:
    def __init__(self, concurrency_limit: int = 4):
        self.queue: asyncio.Queue = asyncio.Queue()
        self.subscribers: Dict[str, asyncio.Queue] = {}
        self.runner = SandboxExecutionEngine()
        self.concurrency_limit = concurrency_limit
        self.active_workers = 0
        self.worker_tasks: List[asyncio.Task] = []

    def start_workers(self):
        """Spawns background consumer workers."""
        for i in range(self.concurrency_limit):
            task = asyncio.create_task(self._worker_loop(f"worker-pod-{i+1}"))
            self.worker_tasks.append(task)

    async def enqueue_submission(self, submission_data: Dict[str, Any]):
        """Pushes a new submission job into the queue."""
        submission_id = submission_data["submission_id"]
        # Create an event stream queue for this submission ID
        self.subscribers[submission_id] = asyncio.Queue()
        
        await self.queue.put(submission_data)
        await self.publish_event(submission_id, {
            "type": "QUEUE_STATUS",
            "status": "QUEUED",
            "message": f"Job {submission_id} queued. Position: {self.queue.qsize()}"
        })

    async def publish_event(self, submission_id: str, event_data: Dict[str, Any]):
        """Sends an event to the client's SSE listener."""
        if submission_id in self.subscribers:
            await self.subscribers[submission_id].put(event_data)

    async def get_event_stream(self, submission_id: str):
        """Async generator yielding events to the SSE endpoint."""
        if submission_id not in self.subscribers:
            self.subscribers[submission_id] = asyncio.Queue()

        sub_queue = self.subscribers[submission_id]
        try:
            while True:
                event = await sub_queue.get()
                yield event
                # Stop stream when completed
                if event.get("type") == "COMPLETED":
                    break
        finally:
            # Clean up subscriber after stream ends
            if submission_id in self.subscribers:
                del self.subscribers[submission_id]

    async def _worker_loop(self, worker_id: str):
        """Continuously pulls jobs from the queue and executes them."""
        while True:
            try:
                job = await self.queue.get()
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

                self.queue.task_done()

            except Exception as e:
                import traceback
                traceback.print_exc()
                print(f"[{worker_id}] Unhandled error: {repr(e)}")
                try:
                    await self.publish_event(sub_id, {
                        "type": "COMPLETED",
                        "status": "RUNTIME_ERROR",
                        "error": str(e),
                        "logs": [f"Worker crashed: {repr(e)}"]
                    })
                except Exception:
                    pass
                await asyncio.sleep(0.5)

    @property
    def queue_depth(self) -> int:
        return self.queue.qsize()

    @property
    def worker_count(self) -> int:
        return self.concurrency_limit

queue_manager = QueueManager()
