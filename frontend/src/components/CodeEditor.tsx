"use client";

import React from "react";
import Editor from "@monaco-editor/react";
import { Play, Send, RotateCcw, Code2 } from "lucide-react";
import styles from "./CodeEditor.module.css";

interface CodeEditorProps {
  language: string;
  setLanguage: (lang: string) => void;
  code: string;
  setCode: (code: string) => void;
  onRunTest: () => void;
  onSubmit: () => void;
  onReset: () => void;
  isExecuting: boolean;
}

const SUPPORTED_LANGUAGES = [
  { id: "python", name: "Python 3 (3.11)", monaco: "python" },
  { id: "cpp", name: "C++ (GCC 12)", monaco: "cpp" },
  { id: "javascript", name: "JavaScript (Node 20)", monaco: "javascript" },
  { id: "go", name: "Go (1.21)", monaco: "go" },
];

export const CodeEditor: React.FC<CodeEditorProps> = ({
  language,
  setLanguage,
  code,
  setCode,
  onRunTest,
  onSubmit,
  onReset,
  isExecuting,
}) => {
  const currentLangObj =
    SUPPORTED_LANGUAGES.find((l) => l.id === language) || SUPPORTED_LANGUAGES[0];

  return (
    <div className={styles.container}>
      {/* Top Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.leftTools}>
          <div className={styles.langSelectWrapper}>
            <Code2 size={16} className={styles.codeIcon} />
            <select
              className={styles.langSelect}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={isExecuting}
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>

          <button
            className={styles.iconBtn}
            onClick={onReset}
            title="Reset code template"
            disabled={isExecuting}
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>
        </div>

        <div className={styles.actionButtons}>
          <button
            className={styles.runBtn}
            onClick={onRunTest}
            disabled={isExecuting}
          >
            <Play size={14} />
            <span>Run Code</span>
          </button>
          <button
            className={styles.submitBtn}
            onClick={onSubmit}
            disabled={isExecuting}
          >
            <Send size={14} />
            <span>Submit Solution</span>
          </button>
        </div>
      </div>

      {/* Monaco Editor Container */}
      <div className={styles.editorArea}>
        <Editor
          height="100%"
          language={currentLangObj.monaco}
          value={code}
          theme="vs-dark"
          onChange={(val) => setCode(val || "")}
          options={{
            fontSize: 14,
            fontFamily: "var(--font-mono)",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            bracketPairColorization: { enabled: true },
            lineNumbers: "on",
            padding: { top: 12, bottom: 12 },
          }}
        />
      </div>
    </div>
  );
};
