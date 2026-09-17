import React from "react";
import styles from "../../users/page.module.css";
import { BarChart2 } from "lucide-react";

export default function AnalyticsFeaturesPage() {
  const stats = [
    { label: "Total Features", value: 42, color: "var(--primary)" },
    { label: "Active Features", value: 38, color: "var(--success)" },
    { label: "Deprecated", value: 4, color: "var(--error)" },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Feature Analytics</h1>
          <p className={styles.subtitle}>Overview of feature usage and status.</p>
        </div>
      </div>

      <div className={styles.statsRow}>
        {stats.map((stat) => (
          <div key={stat.label} className={styles.statCard}>
            <BarChart2 size={20} className={styles.statIcon} style={{ color: stat.color }} />
            <div>
              <div className={styles.statValue} style={{ color: stat.color }}>{stat.value}</div>
              <div className={styles.statLabel}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
