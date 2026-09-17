import React from "react";
import styles from "../../users/page.module.css";
import { BarChart2 } from "lucide-react";

export default function AnalyticsRevenuePage() {
  const stats = [
    { label: "Total Revenue", value: "$124,560", color: "var(--primary)" },
    { label: "Monthly Recurring", value: "$9,870", color: "var(--success)" },
    { label: "Churned", value: "$1,420", color: "var(--error)" },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Revenue Analytics</h1>
          <p className={styles.subtitle}>Overview of revenue performance.</p>
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
