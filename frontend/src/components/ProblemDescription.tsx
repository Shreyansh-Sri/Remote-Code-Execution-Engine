"use client";

import React from "react";
import { Problem } from "@/types/judge";
import { CheckCircle2, AlertCircle, FileText, Sparkles } from "lucide-react";
import styles from "./ProblemDescription.module.css";

interface ProblemDescriptionProps {
  problem: Problem;
  allProblems: Problem[];
  onSelectProblem: (p: Problem) => void;
}

export const ProblemDescription: React.FC<ProblemDescriptionProps> = ({
  problem,
  allProblems,
  onSelectProblem,
}) => {
  return (
    <div className={styles.container}>
      {/* Problem Selection Header */}
      <div className={styles.header}>
        <div className={styles.selectWrapper}>
          <FileText size={16} className={styles.icon} />
          <select
            className={styles.problemSelect}
            value={problem.id}
            onChange={(e) => {
              const selected = allProblems.find((p) => p.id === e.target.value);
              if (selected) onSelectProblem(selected);
            }}
          >
            {allProblems.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.difficulty})
              </option>
            ))}
          </select>
        </div>

        <div className={styles.badges}>
          <span
            className={`badge ${
              problem.difficulty === "Easy"
                ? "badge-easy"
                : problem.difficulty === "Medium"
                ? "badge-medium"
                : "badge-hard"
            }`}
          >
            {problem.difficulty}
          </span>
          <span className={styles.acceptance}>
            Acceptance: <strong>{problem.acceptance}</strong>
          </span>
        </div>
      </div>

      {/* Content */}
      <div className={styles.body}>
        <h1 className={styles.title}>{problem.title}</h1>

        <div className={styles.description}>
          {problem.description.split("\n\n").map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>

        {/* Examples */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            <Sparkles size={16} className={styles.sectionIcon} /> Examples
          </h3>
          {problem.examples.map((ex, index) => (
            <div key={index} className={styles.exampleCard}>
              <div className={styles.exampleHeader}>Example {index + 1}:</div>
              <div className={styles.exampleContent}>
                <div className={styles.ioRow}>
                  <span className={styles.ioLabel}>Input:</span>
                  <code className={styles.codeSnippet}>{ex.input}</code>
                </div>
                <div className={styles.ioRow}>
                  <span className={styles.ioLabel}>Output:</span>
                  <code className={styles.codeSnippet}>{ex.output}</code>
                </div>
                {ex.explanation && (
                  <div className={styles.ioRow}>
                    <span className={styles.ioLabel}>Explanation:</span>
                    <span className={styles.explanationText}>{ex.explanation}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Constraints */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            <AlertCircle size={16} className={styles.sectionIcon} /> Constraints
          </h3>
          <ul className={styles.constraintList}>
            {problem.constraints.map((c, i) => (
              <li key={i}>
                <code>{c}</code>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
