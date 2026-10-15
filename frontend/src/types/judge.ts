export interface TestCase {
  id: number;
  input: string;
  expectedOutput: string;
  actualOutput?: string;
  executionTimeMs?: number;
  memoryMb?: number;
  status?: "PENDING" | "RUNNING" | "PASSED" | "FAILED" | "TLE" | "MLE";
  logs?: string;
}

export interface Problem {
  id: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  acceptance: string;
  description: string;
  examples: {
    input: string;
    output: string;
    explanation?: string;
  }[];
  constraints: string[];
  defaultTemplates: Record<string, string>;
  testCases: TestCase[];
}

export type SubmissionStatus =
  | "IDLE"
  | "QUEUED"
  | "SPAWNING_SANDBOX"
  | "RUNNING"
  | "ACCEPTED"
  | "WRONG_ANSWER"
  | "TIME_LIMIT_EXCEEDED"
  | "MEMORY_LIMIT_EXCEEDED"
  | "RUNTIME_ERROR"
  | "COMPILATION_ERROR";

export interface StreamEvent {
  type: "QUEUE_STATUS" | "SANDBOX_INIT" | "TEST_PROGRESS" | "EXECUTION_COMPLETE" | "LOG";
  timestamp: number;
  data: any;
}
