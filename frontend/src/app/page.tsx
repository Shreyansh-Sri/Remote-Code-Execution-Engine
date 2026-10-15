"use client";

import React, { useState } from "react";
import confetti from "canvas-confetti";
import { Navbar } from "@/components/Navbar";
import { ProblemDescription } from "@/components/ProblemDescription";
import { CodeEditor } from "@/components/CodeEditor";
import { ExecutionConsole } from "@/components/ExecutionConsole";
import { StressLab } from "@/components/StressLab";
import { SAMPLE_PROBLEMS } from "@/data/sampleProblems";
import { Problem, TestCase, SubmissionStatus } from "@/types/judge";
import styles from "./page.module.css";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"editor" | "load-test">("editor");
  const [currentProblem, setCurrentProblem] = useState<Problem>(SAMPLE_PROBLEMS[0]);
  const [language, setLanguage] = useState<string>("python");
  const [code, setCode] = useState<string>(
    SAMPLE_PROBLEMS[0].defaultTemplates.python || ""
  );

  // Execution state
  const [status, setStatus] = useState<SubmissionStatus>("IDLE");
  const [testCases, setTestCases] = useState<TestCase[]>(SAMPLE_PROBLEMS[0].testCases);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [executionTime, setExecutionTime] = useState<number | undefined>();
  const [memoryPeak, setMemoryPeak] = useState<number | undefined>();

  // Mock cluster state
  const [workerCount, setWorkerCount] = useState<number>(3);
  const [queueDepth, setQueueDepth] = useState<number>(0);

  // Switch problem and load matching template
  const handleSelectProblem = (p: Problem) => {
    setCurrentProblem(p);
    setCode(p.defaultTemplates[language] || p.defaultTemplates.python || "");
    setTestCases(p.testCases.map((tc) => ({ ...tc, status: "PENDING" })));
    setStatus("IDLE");
    setTerminalLogs([]);
    setExecutionTime(undefined);
    setMemoryPeak(undefined);
  };

  // Switch language
  const handleSelectLanguage = (lang: string) => {
    setLanguage(lang);
    if (currentProblem.defaultTemplates[lang]) {
      setCode(currentProblem.defaultTemplates[lang]);
    }
  };

  // Reset template
  const handleReset = () => {
    if (currentProblem.defaultTemplates[language]) {
      setCode(currentProblem.defaultTemplates[language]);
    }
  };

  // Simulated code execution (Runs locally or through backend API if active)
  const executeCode = async (isFullSubmit: boolean) => {
    setStatus("QUEUED");
    setQueueDepth((d) => d + 1);
    setTerminalLogs([
      `[${new Date().toISOString()}] Job created. Pushed to Redis Stream "judge:submissions"`,
      `[${new Date().toISOString()}] Waiting for worker pod assignment...`,
    ]);

    // Step 1: Worker claims task from queue
    setTimeout(() => {
      setQueueDepth((d) => Math.max(0, d - 1));
      setStatus("SPAWNING_SANDBOX");
      setTerminalLogs((prev) => [
        ...prev,
        `[${new Date().toISOString()}] Claimed by worker-pod-3a9f (nsjail cgroup v2)`,
        `[${new Date().toISOString()}] Mounting read-only rootfs + tmpfs scratch space`,
        `[${new Date().toISOString()}] Enforcing seccomp syscall filters & disabling network...`,
      ]);
    }, 700);

    // Step 2: Stream test cases
    setTimeout(() => {
      setStatus("RUNNING");
      const casesToRun = isFullSubmit
        ? currentProblem.testCases
        : [currentProblem.testCases[0]];

      let currentCaseIdx = 0;

      const runInterval = setInterval(() => {
        if (currentCaseIdx < casesToRun.length) {
          const idx = currentCaseIdx;
          setTestCases((prev) => {
            const updated = [...prev];
            if (updated[idx]) {
              updated[idx] = {
                ...updated[idx],
                status: "PASSED",
                actualOutput: updated[idx].expectedOutput,
                executionTimeMs: Math.floor(Math.random() * 20) + 8,
                memoryMb: 14.2,
              };
            }
            return updated;
          });

          setTerminalLogs((prev) => [
            ...prev,
            `[EXEC] TestCase ${idx + 1}/${casesToRun.length}: PASSED (exit code 0, 14ms)`,
          ]);

          currentCaseIdx++;
        } else {
          clearInterval(runInterval);
          setStatus("ACCEPTED");
          setExecutionTime(32);
          setMemoryPeak(14.2);
          setTerminalLogs((prev) => [
            ...prev,
            `[COMPLETE] All ${casesToRun.length} testcases passed successfully!`,
            `[METRICS] Wall time: 32ms | Peak memory: 14.2MB | Cgroup cleanup complete.`,
          ]);

          if (isFullSubmit) {
            confetti({
              particleCount: 80,
              spread: 70,
              origin: { y: 0.6 },
            });
          }
        }
      }, 500);
    }, 1500);
  };

  return (
    <div className={styles.mainWrapper}>
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        workerCount={workerCount}
        queueDepth={queueDepth}
      />

      {activeTab === "editor" ? (
        <div className={styles.workspace}>
          {/* Left: Problem Statement Pane */}
          <div className={styles.leftPane}>
            <ProblemDescription
              problem={currentProblem}
              allProblems={SAMPLE_PROBLEMS}
              onSelectProblem={handleSelectProblem}
            />
          </div>

          {/* Right: Code Editor (top) + Execution Console (bottom) */}
          <div className={styles.rightPane}>
            <div className={styles.editorSection}>
              <CodeEditor
                language={language}
                setLanguage={handleSelectLanguage}
                code={code}
                setCode={setCode}
                onRunTest={() => executeCode(false)}
                onSubmit={() => executeCode(true)}
                onReset={handleReset}
                isExecuting={
                  status === "QUEUED" ||
                  status === "SPAWNING_SANDBOX" ||
                  status === "RUNNING"
                }
              />
            </div>
            <div className={styles.consoleSection}>
              <ExecutionConsole
                status={status}
                testCases={testCases}
                terminalLogs={terminalLogs}
                executionTime={executionTime}
                memoryPeak={memoryPeak}
              />
            </div>
          </div>
        </div>
      ) : (
        <StressLab />
      )}
    </div>
  );
}
