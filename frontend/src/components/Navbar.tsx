"use client";

import React, { useState } from "react";
import { Cpu, Terminal, Zap, Code2, Activity, User, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { AuthModal } from "@/components/AuthModal";
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
  const { user, logout } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  return (
    <>
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

        {/* Right Section: Cluster Metrics + Auth */}
        <div className={styles.rightSection}>
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

          {/* User Profile or Sign In Button */}
          {user ? (
            <div className={styles.userPill}>
              <div className={styles.avatar}>
                {user.username.charAt(0).toUpperCase()}
              </div>
              <span className={styles.userName}>{user.username}</span>
              <span className={styles.solvedBadge}>
                {user.solved_problems?.length || 0} Solved
              </span>
              <button className={styles.logoutBtn} onClick={logout} title="Sign Out">
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button className={styles.signInBtn} onClick={() => setIsAuthModalOpen(true)}>
              <User size={14} />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </header>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </>
  );
};
