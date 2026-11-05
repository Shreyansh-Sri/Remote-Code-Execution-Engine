"""
CodeArena Execution Engine Worker Process.

Continuously consumes jobs from Redis Streams (consumer group 'judge_group'),
spawns sandboxed runner containers, and streams real-time execution results back
via Redis Pub/Sub.
"""

import sys
import asyncio

# On Windows (if run locally), use ProactorEventLoop
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from queue_manager import queue_manager

async def main():
    print("[*] Worker node initializing...")
    await queue_manager.initialize()
    print("[*] Starting runner worker threads...")
    queue_manager.start_workers()
    print("[*] Worker ready and listening for submissions!")
    # Keep running forever
    await asyncio.Event().wait()

if __name__ == "__main__":
    asyncio.run(main())

