# CodeArena — Remote Code Execution Engine

> A production-grade, sandboxed LeetCode-style judge with real-time streaming, Docker isolation, and Kubernetes-ready autoscaling architecture.

---

## 📸 Screenshots

> Monaco editor with live SSE streaming, per-test-case verdicts, and sandbox telemetry terminal.

---

## 🏗️ Architecture

```
[ Next.js Frontend ]
        │  ▲
        │  │  Server-Sent Events (SSE)
        ▼  │
┌─────────────────────────┐
│   FastAPI API Gateway   │  ← POST /api/submissions
│   (port 8080)           │  ← GET  /api/submissions/:id/stream
└──────────┬──────────────┘
           │  asyncio.Queue (Redis Streams in production)
           ▼
┌─────────────────────────┐
│   Worker Pool (4 tasks) │  ← pulls jobs from queue
└──────────┬──────────────┘
           │  docker run
           ▼
┌─────────────────────────────────────────────┐
│  Isolated Docker Container (per submission) │
│  --network none    --memory 256m            │
│  --pids-limit 32   --read-only              │
│  --cap-drop ALL    --security-opt           │
│  runner-python / runner-cpp / runner-node   │
└─────────────────────────────────────────────┘
           │  stdout / stderr / exit code
           ▼
┌─────────────────────────┐
│  Verdict Engine         │  AC / WA / TLE / MLE / RE / CE
└──────────┬──────────────┘
           │  publish events
           ▼
   SSE stream → Frontend
```

---

## ✨ Features

- **Multi-language support** — Python 3, C++ (GCC), JavaScript (Node.js), Go
- **Real-time streaming** — Server-Sent Events stream per-test-case results live to the browser as they execute
- **Docker sandboxing** — every submission runs in a throwaway container with hard resource limits
- **Security controls** — no network access, read-only filesystem, capped memory, PID limits, all Linux capabilities dropped
- **Verdict engine** — maps exit codes and resource signals to AC / WA / TLE / MLE / RE / CE
- **Monaco editor** — the same editor powering VS Code and LeetCode
- **Async worker pool** — 4 concurrent workers process submissions without blocking the API
- **StressLab tab** — simulates 500 concurrent submissions with KEDA autoscaling visualisation
- **Health endpoint** — `/api/health` exposes live queue depth and worker count

---

## 🔒 Sandbox Security

Each submission is executed inside a Docker container with the following constraints:

| Control | Value | Prevents |
|---|---|---|
| `--network none` | No internet | SSRF, reverse shells, data exfiltration |
| `--memory 256m` | 256 MB RAM | Memory exhaustion attacks |
| `--memory-swap 256m` | No swap | Swap-based memory bypass |
| `--pids-limit 32` | Max 32 processes | Fork bombs |
| `--cpus 1` | 1 CPU core | CPU starvation of other jobs |
| `--read-only` | Immutable filesystem | Writing malicious files |
| `--tmpfs /tmp` | 64 MB scratch only | Disk exhaustion |
| `--cap-drop ALL` | No Linux capabilities | Privilege escalation |
| `--security-opt no-new-privileges` | Cannot gain privileges | setuid attacks |
| Non-root user (uid 65534) | Unprivileged sandbox user | Container escape |
| Output capped at 1 MB | Stdout truncated | Memory exhaustion via output |
| Wall-clock timeout 2s | Process killed externally | Infinite loops |

---

## 🧪 Adversarial Test Suite

```bash
cd backend
python -m pytest test_sandbox.py -v
```

| Test | What it proves |
|---|---|
| `test_normal_code` | Correct solution returns ACCEPTED |
| `test_infinite_loop` | TLE returned within 3 seconds |
| `test_fork_bomb` | Host machine survives `os.fork()` loop |
| `test_memory_hog` | 300 MB allocation returns MLE |
| `test_read_host_files` | Container cannot read `/etc/passwd` |
| `test_network_access` | No outbound connections possible |
| `test_huge_output` | 10 MB stdout does not crash backend |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, TypeScript, Monaco Editor, CSS Modules |
| Backend | Python 3.12, FastAPI, uvicorn, sse-starlette |
| Queue | `asyncio.Queue` (Redis Streams upgrade path ready) |
| Sandbox | Docker with cgroup v2 resource constraints |
| Runner images | `runner-python`, `runner-cpp`, `runner-node` |
| Streaming | Server-Sent Events (SSE) |
| Scaling (planned) | Kubernetes + KEDA on queue depth |

---

## 📁 Project Structure

```
Remote-Code-Execution-Engine/
├── backend/
│   ├── main.py                  # FastAPI app, endpoints, lifespan
│   ├── queue_manager.py         # Async worker pool and event broadcaster
│   ├── problems.py              # Problem definitions and test cases
│   ├── requirements.txt
│   ├── test_sandbox.py          # Adversarial security tests
│   ├── runner/
│   │   ├── sandbox.py           # Docker-based execution engine
│   │   └── languages.py         # Per-language Docker config
│   └── runners/
│       ├── Dockerfile.python
│       ├── Dockerfile.cpp
│       └── Dockerfile.javascript
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx         # Main judge page, SSE client
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── CodeEditor.tsx   # Monaco editor wrapper
│   │   │   ├── ExecutionConsole.tsx  # Test cases + terminal
│   │   │   ├── Navbar.tsx       # Live cluster metrics
│   │   │   ├── ProblemDescription.tsx
│   │   │   └── StressLab.tsx    # 500-concurrency simulator
│   │   ├── data/
│   │   │   └── sampleProblems.ts
│   │   └── types/
│   │       └── judge.ts
├── docker-compose.yml
└── README.md
```

---

## 🚀 Run Locally

### Prerequisites

- Docker Desktop with WSL2 (Windows) or Docker Engine (Linux/Mac)
- Node.js 20+
- Python 3.12+
- g++ (for C++ support)

### 1. Clone the repo

```bash
git clone https://github.com/Shreyansh-Sri/Remote-Code-Execution-Engine.git
cd Remote-Code-Execution-Engine
```

### 2. Build runner images

```bash
docker build -f backend/runners/Dockerfile.python     -t runner-python .
docker build -f backend/runners/Dockerfile.cpp        -t runner-cpp .
docker build -f backend/runners/Dockerfile.javascript -t runner-node .
```

### 3. Start the backend

```bash
cd backend
pip install -r requirements.txt
python main.py
# API running at http://localhost:8080
# Docs at http://localhost:8080/docs
```

### 4. Start the frontend

```bash
cd frontend
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:8080 in .env.local
npm install
npm run dev
# Frontend at http://localhost:3000
```

### 5. Or run everything with Docker Compose

```bash
docker-compose up --build
```

---

## 🌐 Deploy

### Frontend → Vercel (free)

```bash
cd frontend
npx vercel
# Set NEXT_PUBLIC_API_URL to your backend URL in Vercel dashboard
```

### Backend → Oracle Cloud Free Tier (free forever)

Oracle Cloud's Always Free tier provides a 4-core ARM VM with 24 GB RAM — enough to run the backend and all runner containers at no cost.

```bash
# On your Oracle Cloud Ubuntu VM:
sudo apt update && sudo apt install -y docker.io docker-compose git
sudo usermod -aG docker ubuntu && newgrp docker

git clone https://github.com/Shreyansh-Sri/Remote-Code-Execution-Engine.git
cd Remote-Code-Execution-Engine

docker build -f backend/runners/Dockerfile.python     -t runner-python .
docker build -f backend/runners/Dockerfile.cpp        -t runner-cpp .
docker build -f backend/runners/Dockerfile.javascript -t runner-node .

docker-compose up -d --build
```

Open ports 3000 and 8080 in Oracle Cloud's Security List and on the host firewall.

---

## 📡 API Reference

### POST `/api/submissions`

Submit code for execution.

```json
// Request
{
  "problem_id": "two-sum",
  "language": "python",
  "code": "...",
  "only_first_case": false
}

// Response
{
  "submission_id": "sub_a3f9c1d2",
  "status": "QUEUED",
  "queue_depth": 1
}
```

### GET `/api/submissions/:id/stream`

SSE stream of execution events.

```
event: message
data: {"type": "QUEUE_STATUS", "status": "QUEUED"}

event: message
data: {"type": "SANDBOX_INIT", "language": "python"}

event: message
data: {"type": "LOG", "message": "[10:31:02] Compiling..."}

event: message
data: {"type": "TEST_PROGRESS", "case_id": 1, "status": "PASSED", "execution_time_ms": 14}

event: message
data: {"type": "COMPLETED", "status": "ACCEPTED", "total_time_ms": 28.4}
```

### GET `/api/health`

```json
{
  "status": "healthy",
  "workers_active": 4,
  "queue_depth": 0
}
```

---

## 🗺️ Roadmap

- [x] FastAPI backend with async worker pool
- [x] Docker-based sandbox with resource limits
- [x] Server-Sent Events real-time streaming
- [x] Next.js frontend with Monaco editor
- [x] Multi-language support (Python, C++, JS)
- [x] Adversarial security test suite
- [ ] Redis Streams (replace asyncio.Queue)
- [ ] Kubernetes deployment manifests
- [ ] KEDA autoscaling on queue depth
- [ ] k6 load test with real benchmark results
- [ ] Go language support
- [ ] User authentication
- [ ] Submission history

---

## ⚠️ Known Limitations

- Queue is in-memory (`asyncio.Queue`) — jobs are lost on server restart. Redis Streams upgrade is the next planned step.
- StressLab is a front-end simulation, not a live k6 load test. Real benchmark data will replace it after Kubernetes deployment.
- Memory measurement (`memory_mb`) is not yet reading from cgroup — currently not reported.
- Hidden test cases for judge problems are stored in `problems.py` on the backend and never sent to the client.

---

## 👤 Author

Build By - **Shreyansh Srivastava**
