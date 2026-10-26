# ⚡ CodeArena — Remote Code Execution Engine

A **full-stack, real-time remote code execution platform** inspired by LeetCode's judge system. Users write code in a browser-based Monaco editor, submit it, and receive live test-case results streamed via Server-Sent Events (SSE) — all executed inside **Docker-isolated sandboxes**.

---

## 🏗️ Architecture

`
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                       │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────────┐ │
│  │  Monaco   │  │   Problem    │  │    Execution Console       │ │
│  │  Editor   │  │  Description │  │  (Live SSE Telemetry)      │ │
│  └────┬─────┘  └──────────────┘  └────────────┬───────────────┘ │
│       │           POST /api/submissions        │ SSE Stream      │
└───────┼────────────────────────────────────────┼────────────────┘
        │                                        │
        ▼                                        ▲
┌───────────────────────────────────────────────────────────────┐
│                     Backend (FastAPI + Uvicorn)                │
│                                                               │
│  ┌────────────────┐    ┌──────────────────────────────────┐   │
│  │  API Gateway    │───▶│  Async Queue Manager (4 Workers) │   │
│  │  /api/*         │    │  FIFO Queue + Event Broadcaster  │   │
│  └────────────────┘    └───────────────┬──────────────────┘   │
│                                        │                      │
│                          ┌─────────────▼─────────────┐        │
│                          │  Sandbox Execution Engine  │        │
│                          │  (Docker-backed isolation) │        │
│                          └─────────────┬─────────────┘        │
└────────────────────────────────────────┼──────────────────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    ▼                    ▼                    ▼
            ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
            │ 🐳 Python    │  │ 🐳 Node.js   │  │ 🐳 GCC 13   │
            │ 3.12-slim    │  │ 20-slim      │  │ bookworm     │
            │ judge-python │  │ judge-js     │  │ judge-cpp    │
            └──────────────┘  └──────────────┘  └──────────────┘
                Docker Containers (--network none, --memory 128m)
`

---

## ✨ Features

| Feature | Details |
|---------|---------|
| **Multi-Language Support** | Python 3.12, JavaScript (Node 20), C++ (GCC 13) |
| **Docker Sandbox Isolation** | Each submission runs in a fresh container with no network, memory cap (128MB), CPU limit, and fork-bomb protection |
| **Real-Time SSE Streaming** | Live telemetry: compilation logs, per-testcase PASS/FAIL, execution time, all streamed to the browser |
| **Async Worker Queue** | 4 concurrent background workers dequeue and process submissions in parallel |
| **Monaco Code Editor** | VS Code-grade editor with syntax highlighting, IntelliSense, and theme support |
| **Confetti on AC** | 🎉 Canvas confetti animation when all testcases pass |

---

## 📁 Project Structure

`
Remote-Code-Execution-Engine/
├── backend/
│   ├── main.py                  # FastAPI entry point (API routes, CORS, lifespan)
│   ├── queue_manager.py         # Async FIFO queue + SSE event broadcaster
│   ├── problems.py              # Test case definitions (Two Sum, Reverse String, etc.)
│   ├── requirements.txt         # Python dependencies
│   ├── runner/
│   │   ├── sandbox.py           # Docker-backed execution engine
│   │   └── languages.py         # Language configs (file names, run commands)
│   └── runners/
│       ├── Dockerfile.python    # Python runner image
│       ├── Dockerfile.javascript# Node.js runner image
│       └── Dockerfile.cpp       # C++ runner image
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx         # Main page (3-panel layout)
│   │   │   └── globals.css      # Global styles
│   │   ├── components/
│   │   │   ├── Navbar.tsx       # Top navigation bar with cluster metrics
│   │   │   ├── CodeEditor.tsx   # Monaco editor wrapper
│   │   │   ├── ProblemDescription.tsx  # Problem statement panel
│   │   │   ├── ExecutionConsole.tsx    # Live execution output panel
│   │   │   └── StressLab.tsx    # Stress testing panel
│   │   ├── data/
│   │   │   └── sampleProblems.ts # Problem definitions + starter code
│   │   └── types/
│   │       └── judge.ts         # TypeScript type definitions
│   └── package.json
│
└── README.md
`

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.10
- **Docker Desktop** (with WSL 2 backend on Windows)

### 1. Build Docker Runner Images

`ash
cd backend/runners

docker build -f Dockerfile.python     -t judge-python .
docker build -f Dockerfile.javascript -t judge-javascript .
docker build -f Dockerfile.cpp        -t judge-cpp .
`

### 2. Start the Backend

`ash
cd backend
python -m venv venv

# Windows
.\venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
`

### 3. Start the Frontend

`ash
cd frontend
npm install
npm run dev
`

### 4. Open the App

Navigate to **http://localhost:3000** — select a problem, write your solution, and click **Run Test**.

---

## 🔒 Sandbox Security

Every submission executes inside a Docker container with:

| Constraint | Value |
|-----------|-------|
| Network | `--network none` (fully disabled) |
| Memory | `--memory 128m` |
| CPU | `--cpus 1` |
| Processes | `--pids-limit 64` (fork bomb protection) |
| Timeout | 5 seconds wall-clock (configurable) |
| Filesystem | Ephemeral temp directory, destroyed after execution |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 19, Monaco Editor, Lucide Icons, Canvas Confetti |
| **Backend** | FastAPI, Uvicorn, Pydantic, SSE-Starlette |
| **Execution** | Docker (Python 3.12, Node 20, GCC 13) |
| **Streaming** | Server-Sent Events (SSE) |

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/submissions` | Submit code for execution |
| `GET` | `/api/submissions/{id}/stream` | SSE stream of execution events |
| `GET` | `/api/health` | Cluster health + worker metrics |

---

## 📄 License

MIT

---

**Built with ❤️ by [Shreyansh Sri](https://github.com/Shreyansh-Sri)**
