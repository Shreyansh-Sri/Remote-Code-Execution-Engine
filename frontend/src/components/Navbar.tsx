"use client";

import React from "react";
import { Cpu, Terminal, Zap, Code2, Activity } from "lucide-react";
import styles from "./Navbar.module.css";

interface NavbarProps {
  activeTab: "editor" | "load-test";
  setActiveTab: (tab: "editor" | "load-test") => void;
  workerCount: number;
  queueDepth: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  workerCount,
  queueDepth,
}) => {
  return (
    <header className={styles.navbar}>
      <div className={styles.brand}>
        <div className={styles.logoIcon}>
          <Code2 size={20} className={styles.codeLogo} />
        </div>
        <div>
          <div className={styles.titleWrapper}>
            <span className={styles.brandTitle}>CodeArena</span>
            <span className={styles.badgeVersion}>v1.0 (k8s-ready)</span>
          </div>
          <span className={styles.brandSubtitle}>
            Sandboxed Multi-Tenant Execution Engine
          </span>
        </div>
      </div>

      {/* Center Navigation Tabs */}
      <nav className={styles.navTabs}>
        <button
          className={`${styles.tabBtn} ${activeTab === "editor" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("editor")}
        >
          <Terminal size={16} />
          <span>Code Judge</span>
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === "load-test" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("load-test")}
        >
          <Zap size={16} />
          <span>500 Concurrency Flex</span>
          <span className={styles.hotBadge}>Stress Lab</span>
        </button>
      </nav>

      {/* Cluster Live Metrics Header */}
      <div className={styles.clusterMetrics}>
        <div className={styles.metricItem}>
          <Activity size={14} className={styles.queueIcon} />
          <span className={styles.metricLabel}>Queue Backlog:</span>
          <span className={`${styles.metricVal} ${queueDepth > 0 ? styles.queueActive : ""}`}>
            {queueDepth} jobs
          </span>
        </div>

        <div className={styles.divider} />

        <div className={styles.metricItem}>
          <Cpu size={14} className={styles.workerIcon} />
          <span className={styles.metricLabel}>K8s Workers:</span>
          <span className={styles.metricValHighlighted}>{workerCount} Pods</span>
        </div>
      </div>
    </header>
  );
};
