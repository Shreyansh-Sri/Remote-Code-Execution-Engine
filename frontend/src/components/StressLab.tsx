"use client";

import React, { useState, useEffect } from "react";
import {
  Zap,
  Cpu,
  Server,
  Activity,
  BarChart3,
  CheckCircle,
  AlertTriangle,
  Play,
  RotateCcw,
} from "lucide-react";
import styles from "./StressLab.module.css";

interface StressSubmission {
  id: string;
  lang: string;
  workerId: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  latencyMs: number;
}

export const StressLab: React.FC = () => {
  const [targetConcurrency, setTargetConcurrency] = useState(500);
  const [isRunning, setIsRunning] = useState(false);
  const [activeWorkers, setActiveWorkers] = useState(2);
  const [queueCount, setQueueCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [recentSubmissions, setRecentSubmissions] = useState<StressSubmission[]>([]);

  // Simulation loop for testing 500 concurrent submissions
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRunning) {
      interval = setInterval(() => {
        // KEDA HPA Simulation logic:
        // When queue depth > 30, scale up workers up to 32 pods
        setQueueCount((prevQueue) => {
          if (prevQueue <= 0) {
            setIsRunning(false);
            return 0;
          }

          // Scale up workers dynamically based on queue pressure
          setActiveWorkers((w) => {
            if (prevQueue > 50 && w < 32) return w + 2;
            if (prevQueue < 20 && w > 2) return w - 1;
            return w;
          });

          // Workers process jobs each tick
          const processedBatch = Math.min(prevQueue, activeWorkers * 3);
          setCompletedCount((c) => c + processedBatch);

          // Add simulated records to feed
          const newEntries: StressSubmission[] = Array.from({
            length: Math.min(3, processedBatch),
          }).map((_, i) => ({
            id: `sub_${Math.random().toString(36).substr(2, 6)}`,
            lang: ["Python", "C++", "Go", "JS"][Math.floor(Math.random() * 4)],
            workerId: `worker-pod-${Math.floor(Math.random() * activeWorkers) + 1}`,
            status: "COMPLETED",
            latencyMs: Math.floor(Math.random() * 80) + 18,
          }));

          setRecentSubmissions((prev) => [...newEntries, ...prev].slice(0, 20));

          return Math.max(0, prevQueue - processedBatch);
        });
      }, 350);
    }

    return () => clearInterval(interval);
  }, [isRunning, activeWorkers]);

  const handleStartStressTest = () => {
    setQueueCount(targetConcurrency);
    setCompletedCount(0);
    setFailedCount(0);
    setActiveWorkers(2);
    setRecentSubmissions([]);
    setIsRunning(true);
  };

  const handleReset = () => {
    setIsRunning(false);
    setQueueCount(0);
    setCompletedCount(0);
    setFailedCount(0);
    setActiveWorkers(2);
    setRecentSubmissions([]);
  };

  const progressPercent = Math.min(
    100,
    Math.round((completedCount / (targetConcurrency || 1)) * 100)
  );

  return (
    <div className={styles.container}>
      {/* Title Card */}
      <div className={styles.heroCard}>
        <div className={styles.heroLeft}>
          <div className={styles.heroIconWrapper}>
            <Zap size={28} className={styles.heroIcon} />
          </div>
          <div>
            <h2 className={styles.heroTitle}>K8s Autoscaling & Concurrency Lab</h2>
            <p className={styles.heroDesc}>
              Simulate burst traffic up to <strong>500 concurrent submissions</strong>. Watch
              Redis Queue backlogs trigger KEDA (Kubernetes Event-driven Autoscaling) to spin up
              isolated runner pods.
            </p>
          </div>
        </div>

        <div className={styles.heroControls}>
          <div className={styles.inputGroup}>
            <label>Concurrency Target:</label>
            <select
              value={targetConcurrency}
              onChange={(e) => setTargetConcurrency(Number(e.target.value))}
              disabled={isRunning}
              className={styles.select}
            >
              <option value={50}>50 submissions (Light)</option>
              <option value={150}>150 submissions (Medium)</option>
              <option value={300}>300 submissions (Heavy)</option>
              <option value={500}>500 submissions (Production Burst Flex)</option>
            </select>
          </div>

          <button
            className={styles.launchBtn}
            onClick={handleStartStressTest}
            disabled={isRunning}
          >
            <Play size={16} />
            <span>{isRunning ? "Simulating Under Load..." : "Launch Stress Test"}</span>
          </button>

          <button className={styles.resetBtn} onClick={handleReset}>
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Live Cluster Topology Metrics */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <Activity className={styles.amber} size={18} />
            <span>Redis Queue Backlog</span>
          </div>
          <div className={styles.bigNumber}>{queueCount}</div>
          <span className={styles.metricSub}>Unassigned tasks waiting</span>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <Cpu className={styles.emerald} size={18} />
            <span>K8s Worker Pods (HPA)</span>
          </div>
          <div className={styles.bigNumber}>{activeWorkers} Pods</div>
          <span className={styles.metricSub}>Autoscaled via KEDA ScaledObject</span>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <CheckCircle className={styles.cyan} size={18} />
            <span>Completed Submissions</span>
          </div>
          <div className={styles.bigNumber}>{completedCount}</div>
          <span className={styles.metricSub}>{progressPercent}% total processed</span>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <Server className={styles.indigo} size={18} />
            <span>Avg Sandboxed Latency</span>
          </div>
          <div className={styles.bigNumber}>28 ms</div>
          <span className={styles.metricSub}>Isolated via nsjail & cgroup</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className={styles.progressContainer}>
        <div className={styles.progressBarWrapper}>
          <div
            className={styles.progressBarFill}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className={styles.progressText}>
          <span>Load Test Progress: {completedCount} / {targetConcurrency}</span>
          <span>{progressPercent}% Complete</span>
        </div>
      </div>

      {/* Live Ingestion Stream Feed */}
      <div className={styles.streamFeedContainer}>
        <div className={styles.feedHeader}>
          <BarChart3 size={16} />
          <span>Live Worker Telemetry Stream (SSE / Redis Consumer Group)</span>
        </div>
        <div className={styles.feedList}>
          {recentSubmissions.length === 0 ? (
            <div className={styles.noSubmissions}>
              Click <strong>&quot;Launch Stress Test&quot;</strong> above to initiate 500 concurrent runs and watch K8s pod scaling.
            </div>
          ) : (
            recentSubmissions.map((sub, idx) => (
              <div key={idx} className={styles.feedItem}>
                <span className={styles.subId}>{sub.id}</span>
                <span className={styles.langTag}>{sub.lang}</span>
                <span className={styles.workerTag}>{sub.workerId}</span>
                <span className={styles.latencyTag}>{sub.latencyMs}ms</span>
                <span className="badge badge-accepted">Passed</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
