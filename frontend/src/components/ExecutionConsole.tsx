"use client";

import React, { useState } from "react";
import { TestCase, SubmissionStatus } from "@/types/judge";
import {
  CheckCircle,
  XCircle,
  Clock,
  HardDrive,
  Cpu,
  Layers,
  Terminal as TerminalIcon,
  CheckCircle2,
} from "lucide-react";
import styles from "./ExecutionConsole.module.css";

interface ExecutionConsoleProps {
  status: SubmissionStatus;
  testCases: TestCase[];
  terminalLogs: string[];
  executionTime?: number;
  memoryPeak?: number;
}

export const ExecutionConsole: React.FC<ExecutionConsoleProps> = ({
  status,
  testCases,
  terminalLogs,
  executionTime,
  memoryPeak,
}) => {
  const [activeTab, setActiveTab] = useState<"testcases" | "terminal">("testcases");
  const [selectedCaseIndex, setSelectedCaseIndex] = useState(0);

  // Automatically switch to terminal if an error occurs so the user immediately sees the trace/reason
  React.useEffect(() => {
    if (
      status === "RUNTIME_ERROR" ||
      status === "COMPILATION_ERROR" ||
      status === "TIME_LIMIT_EXCEEDED"
    ) {
      setActiveTab("terminal");
    }
  }, [status]);

  const selectedCase = testCases[selectedCaseIndex] || testCases[0];

  return (
    <div className={styles.container}>
      {/* Console Header Tabs */}
      <div className={styles.header}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tabBtn} ${activeTab === "testcases" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("testcases")}
          >
            <Layers size={15} />
            <span>Test Cases</span>
            {testCases.length > 0 && (
              <span className={styles.caseCountBadge}>{testCases.length}</span>
            )}
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === "terminal" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("terminal")}
          >
            <TerminalIcon size={15} />
            <span>Runner Logs & Telemetry</span>
          </button>
        </div>

        {/* Live Execution Status */}
        <div className={styles.statusSection}>
          {status === "QUEUED" && (
            <span className="badge badge-queued">
              <Clock size={12} /> Queued in Redis
            </span>
          )}
          {status === "SPAWNING_SANDBOX" && (
            <span className="badge badge-running">
              <Cpu size={12} /> Spawning Sandbox
            </span>
          )}
          {status === "RUNNING" && (
            <span className="badge badge-running">
              <Cpu size={12} /> Executing...
            </span>
          )}
          {status === "ACCEPTED" && (
            <span className="badge badge-accepted">
              <CheckCircle size={12} /> Accepted
            </span>
          )}
          {(status === "WRONG_ANSWER" ||
            status === "TIME_LIMIT_EXCEEDED" ||
            status === "MEMORY_LIMIT_EXCEEDED" ||
            status === "RUNTIME_ERROR" ||
            status === "COMPILATION_ERROR") && (
            <span className="badge badge-failed">
              <XCircle size={12} /> {status.replace(/_/g, " ")}
            </span>
          )}

          {executionTime !== undefined && (
            <div className={styles.metricBadge}>
              <Clock size={12} className={styles.cyan} />
              <span>{executionTime} ms</span>
            </div>
          )}

          {memoryPeak !== undefined && (
            <div className={styles.metricBadge}>
              <HardDrive size={12} className={styles.emerald} />
              <span>{memoryPeak.toFixed(1)} MB</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Console View */}
      <div className={styles.content}>
        {activeTab === "testcases" ? (
          <div className={styles.testCasesView}>
            {/* Horizontal testcase buttons */}
            <div className={styles.caseNav}>
              {testCases.map((tc, index) => {
                const isPassed = tc.status === "PASSED";
                const isFailed = tc.status === "FAILED" || tc.status === "TLE";
                const isRunning = tc.status === "RUNNING";

                return (
                  <button
                    key={tc.id}
                    className={`${styles.caseBtn} ${
                      selectedCaseIndex === index ? styles.activeCaseBtn : ""
                    }`}
                    onClick={() => setSelectedCaseIndex(index)}
                  >
                    {isPassed && <CheckCircle2 size={12} className={styles.emerald} />}
                    {isFailed && <XCircle size={12} className={styles.rose} />}
                    {isRunning && <span className={styles.spinner} />}
                    <span>Case {index + 1}</span>
                  </button>
                );
              })}
            </div>

            {/* Test Case Detail */}
            {selectedCase && (
              <div className={styles.caseDetails}>
                <div className={styles.ioBlock}>
                  <span className={styles.blockLabel}>Standard Input (stdin):</span>
                  <pre className={styles.codeBlock}>{selectedCase.input}</pre>
                </div>

                <div className={styles.ioRowGrid}>
                  <div className={styles.ioBlock}>
                    <span className={styles.blockLabel}>Expected Output:</span>
                    <pre className={styles.codeBlock}>{selectedCase.expectedOutput}</pre>
                  </div>
                  <div className={styles.ioBlock}>
                    <span className={styles.blockLabel}>Actual Output (stdout):</span>
                    <pre
                      className={`${styles.codeBlock} ${
                        selectedCase.status === "PASSED"
                          ? styles.passedBlock
                          : selectedCase.status === "FAILED"
                          ? styles.failedBlock
                          : ""
                      }`}
                    >
                      {selectedCase.actualOutput || "(Not executed yet)"}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Streaming Terminal Logs */
          <div className={styles.terminalView}>
            <div className={styles.terminalHeader}>
              <span>Sandbox Isolation: nsjail / seccomp / cgroup v2</span>
              <span>Network: Disabled</span>
            </div>
            <div className={styles.terminalBody}>
              {terminalLogs.length === 0 ? (
                <div className={styles.emptyLogs}>
                  Runner logs will stream here during code execution...
                </div>
              ) : (
                terminalLogs.map((log, i) => (
                  <div key={i} className={styles.logLine}>
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
