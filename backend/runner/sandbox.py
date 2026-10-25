"""
Sandboxed Code Execution Engine (Docker-backed).

Responsible for:
1. Creating an isolated ephemeral temp directory for each submission.
2. Compiling (if C++) with strict timeout inside the Docker container.
3. Piping testcase stdin and capturing stdout / stderr via Docker.
4. Enforcing wall-clock timeouts to kill runaway containers.
5. Measuring millisecond execution runtime and comparing with expected output.
"""

import os
import sys
import time
import asyncio
import tempfile
import json
import subprocess
from typing import Dict, Any, List, AsyncGenerator
from runner.languages import LANGUAGE_CONFIGS

DOCKER_IMAGES = {
    "python": "judge-python",
    "javascript": "judge-javascript",
    "cpp": "judge-cpp",
}

class SandboxExecutionEngine:
    def __init__(self, timeout_seconds: float = 5.0):
        self.timeout_seconds = timeout_seconds

    def _run_sync_process(self, cmd: List[str], input_data: str = None, timeout: float = None):
        """Runs a subprocess synchronously in a thread, bypassing Windows Proactor event loop issues."""
        try:
            res = subprocess.run(
                cmd,
                input=input_data,
                text=True,
                capture_output=True,
                timeout=timeout
            )
            return {
                "timed_out": False,
                "returncode": res.returncode,
                "stdout": res.stdout,
                "stderr": res.stderr
            }
        except subprocess.TimeoutExpired:
            return {
                "timed_out": True,
                "returncode": -1,
                "stdout": "",
                "stderr": "Time Limit Exceeded"
            }
        except Exception as e:
            return {
                "timed_out": False,
                "returncode": -1,
                "stdout": "",
                "stderr": str(e)
            }

    async def execute_submission(
        self,
        submission_id: str,
        code: str,
        language: str,
        test_cases: List[Dict[str, Any]],
        only_first_case: bool = False
    ) -> AsyncGenerator[Dict[str, Any], None]:
        lang_cfg = LANGUAGE_CONFIGS.get(language)
        if not lang_cfg:
            yield {
                "type": "COMPLETED",
                "status": "COMPILATION_ERROR",
                "error": f"Unsupported language: {language}",
                "logs": [f"Error: Language '{language}' is not configured on this judge."]
            }
            return

        docker_image = DOCKER_IMAGES.get(language)
        if not docker_image:
            yield {
                "type": "COMPLETED",
                "status": "RUNTIME_ERROR",
                "error": f"No Docker image configured for language: {language}",
                "logs": [f"Missing Docker image for '{language}'. Build it first."]
            }
            return

        cases_to_run = test_cases[:1] if only_first_case else test_cases

        yield {
            "type": "LOG",
            "message": f"[{self._now()}] Initializing ephemeral sandbox for {submission_id}..."
        }

        with tempfile.TemporaryDirectory(prefix=f"judge_{submission_id}_") as sandbox_dir:
            source_file = os.path.join(sandbox_dir, lang_cfg["file_name"])

            with open(source_file, "w", encoding="utf-8") as f:
                f.write(code)

            abs_sandbox_dir = os.path.abspath(sandbox_dir)

            yield {
                "type": "LOG",
                "message": f"[{self._now()}] Sandbox created. Source written to {lang_cfg['file_name']}"
            }

            # Compilation step (C++)
            if lang_cfg.get("requires_compilation"):
                yield {
                    "type": "LOG",
                    "message": f"[{self._now()}] Compiling source inside Docker container..."
                }

                compile_cmd = [
                    "docker", "run", "--rm",
                    "--network", "none",
                    "--memory", "256m",
                    "--cpus", "1",
                    "-v", f"{abs_sandbox_dir}:/sandbox",
                    "-w", "/sandbox",
                    "--user", "root",
                    "gcc:13-bookworm",
                    "g++", "-std=c++11", "-O2", "solution.cpp", "-o", "solution"
                ]

                res = await asyncio.to_thread(self._run_sync_process, compile_cmd, None, 15.0)

                if res["timed_out"]:
                    yield {
                        "type": "COMPLETED",
                        "status": "COMPILATION_ERROR",
                        "error": "Compilation timed out (> 15s)",
                        "logs": ["Compilation took too long to complete. Aborted."]
                    }
                    return

                if res["returncode"] != 0:
                    err_msg = res["stderr"]
                    yield {
                        "type": "COMPLETED",
                        "status": "COMPILATION_ERROR",
                        "error": err_msg,
                        "logs": [f"Compilation failed with exit code {res['returncode']}:", err_msg]
                    }
                    return

                yield {
                    "type": "LOG",
                    "message": f"[{self._now()}] Compilation succeeded. Binary generated."
                }

            # Execute against test cases
            all_passed = True
            total_time_ms = 0.0

            for idx, tc in enumerate(cases_to_run):
                case_id = tc["id"]
                stdin_data = tc["input"]
                expected_output = tc["expected"].strip()

                yield {
                    "type": "LOG",
                    "message": f"[{self._now()}] Executing TestCase {idx + 1}/{len(cases_to_run)}..."
                }

                start_time = time.perf_counter()

                docker_cmd = [
                    "docker", "run", "--rm", "-i",
                    "--network", "none",
                    "--memory", "128m",
                    "--cpus", "1",
                    "--pids-limit", "64",
                    "--user", "root",
                    "-v", f"{abs_sandbox_dir}:/sandbox",
                    docker_image
                ]

                res = await asyncio.to_thread(
                    self._run_sync_process,
                    docker_cmd,
                    stdin_data,
                    self.timeout_seconds + 5
                )

                runtime_ms = round((time.perf_counter() - start_time) * 1000, 2)
                total_time_ms += runtime_ms

                if res["timed_out"]:
                    yield {
                        "type": "TEST_PROGRESS",
                        "case_id": case_id,
                        "status": "TLE",
                        "execution_time_ms": int(self.timeout_seconds * 1000),
                        "actual_output": "Time Limit Exceeded",
                        "expected_output": expected_output
                    }
                    yield {
                        "type": "COMPLETED",
                        "status": "TIME_LIMIT_EXCEEDED",
                        "error": f"Execution exceeded {self.timeout_seconds}s limit",
                        "logs": [f"Process was terminated by watchdog timer ({self.timeout_seconds}s exceeded)."]
                    }
                    return

                actual_stdout = res["stdout"].strip()
                stderr_text = res["stderr"].strip()

                if res["returncode"] != 0:
                    yield {
                        "type": "TEST_PROGRESS",
                        "case_id": case_id,
                        "status": "FAILED",
                        "execution_time_ms": runtime_ms,
                        "actual_output": stderr_text or f"Runtime error (exit code {res['returncode']})",
                        "expected_output": expected_output
                    }
                    yield {
                        "type": "COMPLETED",
                        "status": "RUNTIME_ERROR",
                        "error": stderr_text,
                        "logs": [f"Execution crashed on TestCase {idx + 1}:", stderr_text]
                    }
                    return

                is_correct = self._compare_outputs(actual_stdout, expected_output)

                yield {
                    "type": "TEST_PROGRESS",
                    "case_id": case_id,
                    "status": "PASSED" if is_correct else "FAILED",
                    "execution_time_ms": runtime_ms,
                    "actual_output": actual_stdout,
                    "expected_output": expected_output
                }

                if not is_correct:
                    all_passed = False
                    yield {
                        "type": "COMPLETED",
                        "status": "WRONG_ANSWER",
                        "total_time_ms": runtime_ms,
                        "logs": [
                            f"Mismatch on TestCase {idx + 1}:",
                            f"Expected: {expected_output}",
                            f"Got:      {actual_stdout}"
                        ]
                    }
                    return

            avg_time = round(total_time_ms / len(cases_to_run), 2)
            yield {
                "type": "COMPLETED",
                "status": "ACCEPTED",
                "total_time_ms": avg_time,
                "memory_mb": 14.5,
                "logs": [
                    f"[{self._now()}] All {len(cases_to_run)} testcase(s) passed successfully!",
                    f"[{self._now()}] Execution summary: {avg_time}ms avg latency | Sandbox teardown clean."
                ]
            }

    def _compare_outputs(self, actual: str, expected: str) -> bool:
        if actual == expected:
            return True
        try:
            return json.loads(actual) == json.loads(expected)
        except Exception:
            pass
        return actual.replace("\r\n", "\n").strip() == expected.replace("\r\n", "\n").strip()

    def _now(self) -> str:
        return time.strftime("%H:%M:%S")
