# CodeArena Local Kubernetes Management Script

param(
    [Parameter(Position=0)]
    [ValidateSet("start", "stop", "status", "build", "scale")]
    [string]$Action = "status"
)

$KIND_EXE = "C:\Users\shrey\AppData\Local\Microsoft\WinGet\Packages\Kubernetes.kind_Microsoft.Winget.Source_8wekyb3d8bbwe\kind.exe"

switch ($Action) {
    "start" {
        Write-Host ">>> Creating Kind cluster 'codearena-cluster'..." -ForegroundColor Cyan
        & $KIND_EXE create cluster --name codearena-cluster --config k8s/kind-config.yaml
        
        Write-Host ">>> Building CodeArena Backend Docker Image..." -ForegroundColor Cyan
        docker build -t codearena-backend:latest ./backend
        
        Write-Host ">>> Loading image into Kind cluster..." -ForegroundColor Cyan
        & $KIND_EXE load docker-image codearena-backend:latest --name codearena-cluster
        
        Write-Host ">>> Applying Kubernetes manifests..." -ForegroundColor Cyan
        kubectl apply -f k8s/redis.yaml
        kubectl apply -f k8s/backend.yaml
        kubectl apply -f k8s/worker.yaml
        
        Write-Host ">>> Installing KEDA autoscaler..." -ForegroundColor Cyan
        kubectl apply --server-side -f https://github.com/kedacore/keda/releases/download/v2.14.0/keda-2.14.0.yaml
        
        Write-Host ">>> Applying KEDA ScaledObject..." -ForegroundColor Cyan
        kubectl apply -f k8s/keda-scaledobject.yaml
        
        Write-Host ">>> CodeArena cluster successfully started!" -ForegroundColor Green
    }
    
    "stop" {
        Write-Host ">>> Deleting Kind cluster 'codearena-cluster'..." -ForegroundColor Yellow
        & $KIND_EXE delete cluster --name codearena-cluster
    }
    
    "status" {
        Write-Host "=== Pods ===" -ForegroundColor Cyan
        kubectl get pods -o wide
        Write-Host "=== Services ===" -ForegroundColor Cyan
        kubectl get svc
        Write-Host "=== KEDA ScaledObjects ===" -ForegroundColor Cyan
        kubectl get scaledobject 2>$null
    }
    
    "build" {
        Write-Host ">>> Rebuilding backend image..." -ForegroundColor Cyan
        docker build -t codearena-backend:latest ./backend
        & $KIND_EXE load docker-image codearena-backend:latest --name codearena-cluster
        kubectl rollout restart deployment/codearena-backend
        kubectl rollout restart deployment/codearena-worker
    }
    
    "scale" {
        Write-Host "=== Real-time Worker Pod Scaling (Ctrl+C to exit) ===" -ForegroundColor Cyan
        kubectl get pods -l app=codearena-worker -w
    }
}

