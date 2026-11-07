# CodeArena — Sandboxed Remote Code Execution Engine

> A production-grade, sandboxed multi-tenant code execution engine with real-time SSE telemetry, Redis Streams job queuing, Kubernetes cluster deployment, and KEDA event-driven autoscaling.


---

## 🏗️ Architecture

```
                       [ Next.js 15 Client ]
                               │  ▲
           POST /api/submissions│  │  Server-Sent Events (SSE)
                               ▼  │  /api/submissions/:id/stream
               ┌───────────────────────────────┐
               │   FastAPI API Gateway         │
               │   (Port 8080 / NodePort 30080)│
               └───────────────┬───────────────┘
                               │
               XADD codearena:submissions
                               ▼
               ┌───────────────────────────────┐
               │   Redis Streams (Port 6379)   │
               │   Consumer Group: judge_group │
               └───────┬───────────────┬───────┘
                       │               │
        Queue Depth /  │               │ XREADGROUP
        Stream Backlog │               │
                       ▼               ▼
        ┌─────────────────────┐   ┌─────────────────────────────────────────┐
        │    KEDA Operator    │   │  Kubernetes Worker Pods                 │
        │    (Autoscaler)     │   │  (codearena-worker: 1 → 10 Pods)        │
        └──────────┬──────────┘   └────────────────────┬────────────────────┘
                   │                                   │
                   │ Spawns / Scales                   │ Spawns via /var/run/docker.sock
                   ▼                                   ▼
        ┌─────────────────────┐   ┌─────────────────────────────────────────┐
        │ Horizontal Pod      │   │ Ephemeral Sandboxed Docker Container    │
        │ Autoscaler (HPA)    │   │ ├── --network none                      │
        └─────────────────────┘   │ ├── --memory 256m --memory-swap 256m    │
                                  │ ├── --pids-limit 32                     │
                                  │ ├── --read-only + tmpfs                 │
                                  │ └── --cap-drop ALL --user 65534         │
                                  │ (judge-python / judge-cpp / judge-node) │
                                  └────────────────────┬────────────────────┘
                                                       │
                                  Verdict: AC / WA / TLE / MLE / RE / CE
                                                       │
                                  PUBLISH codearena:events:{submission_id}
                                                       ▼
                                          [ Redis Pub/Sub Channel ]
                                                       │
                                                       ▼
                                        SSE Stream → Browser Client
```

---

## 📊 Real Load Test Benchmarks (k6 on Kubernetes)

The cluster was load-tested under burst traffic using **Grafana k6** pushing concurrent virtual users to the Kubernetes API Gateway with KEDA active:

```
          /\      Grafana   /‾‾/  
     /\  /  \     |\  __   /  /   
    /  \/    \    | |/ /  /   ‾‾\ 
   /          \   |   (  |  (‾)  |
  / __________ \  |_|\_\  \_____/ 
```

| Metric | Result |
|---|---|
| **Total Submissions Ingested** | **3,496** jobs in 50 seconds |
| **Throughput** | **~70 submissions / second** |
| **HTTP Request Failure Rate** | **0.00%** (0 failed out of 3,496) |
| **Checks Succeeded** | **100.00%** (6,992 / 6,992) |
| **Median Engine Latency** | **856 ms** |
| **Average Latency** | **1.38 s** |
| **P90 Latency** | **3.34 s** |
| **P95 Latency** | **4.44 s** |
| **KEDA Pod Autoscaling** | Dynamically scaled workers from **1 → 3 pods** based on Redis queue depth |

---

## ✨ Features

- **Multi-Language Runtimes**: Isolated Docker sandboxes for **Python 3**, **C++ (GCC)**, and **JavaScript (Node.js)**.
- **End-to-End Real-Time Streaming**: Server-Sent Events (SSE) stream per-test-case verdicts and sandbox console output to the browser in real time.
- **Redis Streams & Consumer Groups**: Queue jobs in persistent streams (`codearena:submissions`) consumed by horizontal workers (`judge_group`) with zero duplication.
- **Cross-Pod Telemetry**: Workers publish execution events over Redis Pub/Sub (`codearena:events:{id}`) directly back to the API gateway and client streams.
- **Kubernetes Autoscaling (KEDA)**: Event-driven autoscaling monitors Redis queue lag and automatically scales runner pods from 1 to 10.
- **Adversarial Security Hardening**: Strict Linux cgroups and container boundaries drop all network access, prevent fork bombs, cap memory, and drop capabilities.
- **Monaco Editor Experience**: Features split-pane code editor, dynamic templates, run testcases fast-path, and submission celebration.
- **StressLab Dashboard**: Visualizes real-time cluster telemetry, active pods, queue depth, and verified k6 benchmarks.

---

## 🔒 Sandbox Security Controls

Every submission runs inside a throwaway container configured with defense-in-depth security:

| Control | Flag / Setting | Attack Mitigated |
|---|---|---|
| **No Network** | `--network none` | SSRF, data exfiltration, port scanning, reverse shells |
| **Memory Limit** | `--memory 256m` | OOM denial-of-service against host machine |
| **Disable Swap** | `--memory-swap 256m` | Bypassing memory quotas via host disk swap |
| **Process Cap** | `--pids-limit 32` | Fork bombs (`:(){ :\|:& };:`) |
| **CPU Quota** | `--cpus 1.0` | CPU exhaustion across judge nodes |
| **Read-Only Root** | `--read-only` | Root filesystem tampering or malware persistence |
| **Scratch Space** | `--tmpfs /tmp:rw,noexec,nosuid,size=64m` | Disk filling; prevents executing binaries from `/tmp` |
| **Drop Capabilities**| `--cap-drop ALL` | Kernel exploitation and privilege escalation |
| **No New Privileges**| `--security-opt no-new-privileges` | `setuid` privilege escalation |
| **Unprivileged User**| `User: 65534 (nobody)` | Root container escapes |
| **Output Limiter** | Capped at 1 MB | Memory exhaustion via endless stdout/stderr printing |
| **Execution Timeout**| 2.0s wall-clock limit | Infinite loops (`while True: pass`) |

---

## 🧪 Adversarial Test Suite

Validate all security controls against hostile code submissions:

```bash
cd backend
python -m pytest test_sandbox.py -v
```

| Security Test | Attack Vector Tested | Verdict Asserted |
|---|---|---|
| `test_normal_code` | Baseline correct algorithm | `ACCEPTED` |
| `test_infinite_loop` | `while True: pass` infinite loop | `TIME_LIMIT_EXCEEDED` |
| `test_fork_bomb` | `while True: os.fork()` process spawn | Host survives, returns `RUNTIME_ERROR` |
| `test_memory_hog` | 300MB bytearray allocation | `MEMORY_LIMIT_EXCEEDED` |
| `test_read_host_files`| Attempting to read `/etc/passwd` | Read access blocked |
| `test_network_access` | Socket connection to `8.8.8.8:80` | `Network is unreachable` |
| `test_huge_output` | Printing 10MB of characters | Stdout capped at 1MB |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15, React 19, TypeScript, Monaco Editor, Lucide Icons, CSS Modules |
| **API Gateway** | Python 3.11/3.12, FastAPI, Uvicorn, SSE-Starlette |
| **Job Queue & Telemetry**| Redis 7 (Redis Streams, Consumer Groups, Pub/Sub) |
| **Container Sandboxes** | Docker Engine, cgroups v2, multi-stage language runners |
| **Orchestration** | Kubernetes (`kind`), Deployments, Services, NodePort |
| **Autoscaling** | KEDA (Kubernetes Event-driven Autoscaling) v2.14, HPA |
| **Load Testing** | Grafana k6 |

---

## 📁 Project Directory Structure

```
Remote-Code-Execution-Engine/
├── backend/
│   ├── main.py                  # FastAPI gateway, routes, SSE endpoints
│   ├── queue_manager.py         # Redis Streams consumer group & Pub/Sub broker
│   ├── worker.py                # Standalone worker daemon for Kubernetes pods
│   ├── problems.py              # Problem definitions, inputs, and test cases
│   ├── requirements.txt         # FastAPI, uvicorn, redis, sse-starlette
│   ├── Dockerfile               # Production image for API gateway & workers
│   ├── test_sandbox.py          # Adversarial test suite
│   ├── runner/
│   │   ├── sandbox.py           # Docker execution manager & cgroup monitor
│   │   └── languages.py         # Per-language compile/run commands
│   └── runners/
│       ├── Dockerfile.python    # Sandbox image: judge-python
│       ├── Dockerfile.cpp       # Sandbox image: judge-cpp
│       └── Dockerfile.javascript# Sandbox image: judge-javascript
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx         # Main judge workspace & live cluster hook
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── CodeEditor.tsx   # Monaco editor with language switcher
│   │   │   ├── ExecutionConsole.tsx # Live testcase progress & logs
│   │   │   ├── Navbar.tsx       # Real-time cluster queue & worker telemetry
│   │   │   ├── ProblemDescription.tsx
│   │   │   └── StressLab.tsx    # KEDA autoscaling lab & k6 benchmarks
│   │   ├── data/
│   │   │   └── sampleProblems.ts
│   │   └── types/
│   │       └── judge.ts
├── k8s/
│   ├── kind-config.yaml         # Local Kubernetes cluster config (ports 8080/3000)
│   ├── redis.yaml               # Redis Deployment & Service
│   ├── backend.yaml             # FastAPI Gateway Deployment & NodePort Service
│   ├── worker.yaml              # Worker Deployment with mounted Docker socket
│   └── keda-scaledobject.yaml   # KEDA ScaledObject for Redis Streams
├── cluster.ps1                  # Cluster management CLI (start, stop, status, scale)
├── loadtest.js                  # Grafana k6 load test script (up to 200 VUs)
├── docker-compose.yml           # Compose setup for Docker-only workflow
└── README.md
```

---

## 🚀 Running the Project

### Option A: Complete Local Kubernetes Cluster with KEDA (Recommended)

This runs the entire distributed system locally on Kubernetes with active autoscaling.

#### 1. Start the cluster & deploy all services
Run the management script:
```powershell
.\cluster.ps1 start
```
*This command will:*
1. Create the `kind` cluster with port mappings (`localhost:8080`).
2. Build the `codearena-backend:latest` image and load it into the cluster.
3. Deploy Redis, FastAPI Gateway, and Worker pods.
4. Install KEDA v2.14 and apply the `ScaledObject`.

#### 2. Verify Cluster Status
```powershell
.\cluster.ps1 status
```
Output:
```
NAME                                 READY   STATUS    RESTARTS   AGE
codearena-backend-xxxx               1/1     Running   0          2m
codearena-worker-xxxx                1/1     Running   0          2m
redis-xxxx                           1/1     Running   0          2m
```

#### 3. Run the Frontend
```bash
cd frontend
npm install
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

#### 4. Run the k6 Load Test and Watch Pods Autoscale
In one terminal, stream the worker pods:
```powershell
.\cluster.ps1 scale
```
In another terminal, run the k6 load test:
```powershell
& "C:\Program Files\k6\k6.exe" run loadtest.js
```
Watch KEDA detect the Redis stream queue depth and scale worker pods from **1 to 3+ pods** in real time!

---

### Option B: Run via Docker Compose

```bash
# Build sandbox runner images
docker build -f backend/runners/Dockerfile.python     -t judge-python backend/runners
docker build -f backend/runners/Dockerfile.cpp        -t judge-cpp backend/runners
docker build -f backend/runners/Dockerfile.javascript -t judge-javascript backend/runners

# Launch Redis + Backend + Frontend
docker-compose up --build
```

---

### Option C: Standalone Local Development

```bash
# 1. Start Redis
docker run -d -p 6379:6379 --name redis redis:7-alpine

# 2. Start Backend API
cd backend
pip install -r requirements.txt
python main.py

# 3. Start Frontend
cd frontend
npm install
npm run dev
```

---

## 📡 API Reference

### 1. Submit Code
`POST /api/submissions`

**Request:**
```json
{
  "problem_id": "two-sum",
  "language": "python",
  "code": "def two_sum(nums, target):\n    lookup = {}\n    for i, n in enumerate(nums):\n        if target - n in lookup:\n            return [lookup[target - n], i]\n        lookup[n] = i\n    return []",
  "only_first_case": false
}
```

**Response (Instant 200 OK):**
```json
{
  "submission_id": "sub_33cc622e",
  "status": "QUEUED",
  "queue_depth": 1,
  "message": "Submission enqueued. Connect to /api/submissions/{id}/stream to follow execution."
}
```

---

### 2. Stream Real-Time Execution Telemetry
`GET /api/submissions/{submission_id}/stream`

**Server-Sent Events (SSE) Stream:**
```
event: message
data: {"type": "QUEUE_STATUS", "status": "QUEUED", "message": "Job sub_33cc622e queued in Redis Stream."}

event: message
data: {"type": "SANDBOX_INIT", "language": "python", "message": "Spawning isolated container judge-python..."}

event: message
data: {"type": "TEST_PROGRESS", "case_id": 1, "status": "PASSED", "execution_time_ms": 18, "actual_output": "[0, 1]"}

event: message
data: {"type": "COMPLETED", "status": "ACCEPTED", "total_time_ms": 32.5, "logs": ["All testcases passed."]}
```

---

### 3. Cluster Health & Telemetry
`GET /api/health`

**Response:**
```json
{
  "status": "healthy",
  "redis_connected": true,
  "workers_active": 4,
  "queue_depth": 0
}
```

---

## 🗺️ Roadmap & Progress

- [x] **Phase 1: Local Engine Core**
  - [x] FastAPI async gateway with SSE streaming
  - [x] Multi-language Docker execution sandbox (`judge-python`, `judge-cpp`, `judge-javascript`)
  - [x] 7-part adversarial security test suite (fork bombs, memory hogs, timeouts, network blocks)
  - [x] Redis Streams integration (`codearena:submissions`) with consumer groups (`judge_group`)
  - [x] Redis Pub/Sub telemetry broadcast across pods
  - [x] Next.js Monaco editor workspace with dynamic templates and cluster polling

- [x] **Phase 2: Kubernetes Orchestration & Autoscaling**
  - [x] Multi-node `kind` local cluster configuration with port routing
  - [x] Production Kubernetes manifests (`redis`, `backend`, `worker`)
  - [x] KEDA installation & `ScaledObject` attached to Redis stream depth
  - [x] Docker socket mounting for sandbox runners
  - [x] Single-command cluster lifecycle manager (`cluster.ps1`)

- [x] **Phase 3: Real Load Testing & Benchmarks**
  - [x] Automated load test suite with **Grafana k6**
  - [x] Burst tested with 200 concurrent users / 3,496 submissions
  - [x] Verified **0.00% failure rate** and **~70 req/s** throughput
  - [x] Verified real-time pod autoscaling from **1 → 3 pods**

- [ ] **Phase 4: Future Enhancements**
  - [ ] Go & Rust runner support
  - [ ] User authentication & submission history
  - [ ] Production cloud deployment (Fly.io / AWS EKS)

---

## 👤 Author


Built by **Shreyansh Srivastava**
