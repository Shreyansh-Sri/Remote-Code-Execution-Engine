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
  const [workerCount] = useState<number>(3);
  const [queueDepth] = useState<number>(0);


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

  // Real backend execution via FastAPI + SSE Streaming
  const executeCode = async (isFullSubmit: boolean) => {
    setStatus("QUEUED");
    setTerminalLogs([
      `[${new Date().toISOString()}] Sending code to Judge API Gateway (http://localhost:8080)...`
    ]);

    // Reset testcases to pending
    setTestCases((prev) => prev.map((tc) => ({ ...tc, status: "PENDING", actualOutput: undefined })));

    try {
      const response = await fetch("http://localhost:8080/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem_id: currentProblem.id,
          language: language,
          code: code,
          only_first_case: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      const { submission_id } = await response.json();
      setTerminalLogs((prev) => [
        ...prev,
        `[${new Date().toISOString()}] Enqueued as ${submission_id}. Connecting to live SSE telemetry...`,
      ]);

      // Connect to Server-Sent Events stream
      const eventSource = new EventSource(`http://localhost:8080/api/submissions/${submission_id}/stream`);

      eventSource.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);

          if (event.type === "QUEUE_STATUS") {
            setStatus("QUEUED");
          } else if (event.type === "SANDBOX_INIT") {
            setStatus("SPAWNING_SANDBOX");
            setTerminalLogs((prev) => [...prev, event.message]);
          } else if (event.type === "LOG") {
            setStatus("RUNNING");
            setTerminalLogs((prev) => [...prev, event.message]);
          } else if (event.type === "TEST_PROGRESS") {
            setTestCases((prev) => {
              const updated = [...prev];
              const idx = updated.findIndex((tc) => tc.id === event.case_id);
              if (idx !== -1) {
                updated[idx] = {
                  ...updated[idx],
                  status: event.status,
                  actualOutput: event.actual_output,
                  executionTimeMs: event.execution_time_ms,
                };
              }
              return updated;
            });
          } else if (event.type === "COMPLETED") {
            setStatus(event.status);
            if (event.total_time_ms) setExecutionTime(event.total_time_ms);
            if (event.memory_mb) setMemoryPeak(event.memory_mb);
            if (event.logs) {
              setTerminalLogs((prev) => [...prev, ...event.logs]);
            }

            if (event.status === "ACCEPTED" && isFullSubmit) {
              confetti({
                particleCount: 80,
                spread: 70,
                origin: { y: 0.6 },
              });
            }

            eventSource.close();
          }
        } catch (err) {
          console.error("SSE parse error", err);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
      };

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setStatus("RUNTIME_ERROR");
      setTerminalLogs((prev) => [
        ...prev,
        `[ERROR] Failed to connect to backend engine: ${errorMessage}`,
        `Ensure backend is running on http://localhost:8000`
      ]);
    }
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
