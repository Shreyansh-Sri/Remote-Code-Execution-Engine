"""
Adversarial sandbox tests.
Run: python -m pytest test_sandbox.py -v
All 7 must pass before moving to Kubernetes.
"""
import asyncio
import pytest
from runner.sandbox import SandboxExecutionEngine

engine = SandboxExecutionEngine(timeout_seconds=2.0)

async def _run(code: str, lang: str = "python", stdin: str = "", expected: str = "x"):
    events = []
    async for e in engine.execute_submission(
        "test-adv-001", code, lang,
        [{"id": 1, "input": stdin, "expected": expected}],
    ):
        events.append(e)
    final = next(e for e in events if e["type"] == "COMPLETED")
    return final["status"]

def test_normal_code():
    """A correct solution must return ACCEPTED."""
    assert asyncio.run(_run('print("x")', expected="x")) == "ACCEPTED"

def test_infinite_loop():
    """Infinite loop must be killed and return TLE within ~3 seconds."""
    status = asyncio.run(_run("while True: pass"))
    assert status == "TIME_LIMIT_EXCEEDED"

def test_fork_bomb():
    """Fork bomb must not crash the host machine."""
    status = asyncio.run(_run("import os\nwhile True: os.fork()"))
    assert status in ("TIME_LIMIT_EXCEEDED", "RUNTIME_ERROR")

def test_memory_hog():
    """Allocating 300MB must return MLE, not crash the backend."""
    status = asyncio.run(_run("x = ' ' * (300 * 1024 * 1024)"))
    assert status == "MEMORY_LIMIT_EXCEEDED"

def test_read_host_files():
    """Container must not be able to read host filesystem."""
    status = asyncio.run(_run("print(open('/etc/passwd').read())"))
    assert status in ("RUNTIME_ERROR", "WRONG_ANSWER")

def test_network_access():
    """Container must have no network access."""
    status = asyncio.run(_run(
        "import urllib.request\n"
        "urllib.request.urlopen('http://google.com')"
    ))
    assert status in ("RUNTIME_ERROR", "TIME_LIMIT_EXCEEDED")

def test_huge_output():
    """10MB of output must not crash the backend (capped at 1MB)."""
    status = asyncio.run(_run("print('A' * 10_000_000)"))
    assert status in ("WRONG_ANSWER", "RUNTIME_ERROR")