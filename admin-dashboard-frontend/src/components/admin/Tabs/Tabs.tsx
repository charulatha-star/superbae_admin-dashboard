'use client';

import React, { useState, type ReactNode } from 'react';
import styles from './Tabs.module.css';

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: ReactNode;
  panel: ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  /** Optional default tab id. Defaults to the first tab. */
  defaultTab?: string;
  ariaLabel?: string;
  /** Called whenever the active tab changes. */
  onTabChange?: (tabId: string) => void;
}

export function Tabs({ tabs, defaultTab, ariaLabel = 'User sections', onTabChange }: TabsProps) {
  const [activeId, setActiveId] = useState(defaultTab ?? tabs[0]?.id ?? '');

  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0];

  return (
    <div className={styles.tabs}>
      <div className={styles.tabBar} role="tablist" aria-label={ariaLabel}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === activeTab?.id}
            aria-controls={`panel-${tab.id}`}
            className={`${styles.tab}${tab.id === activeTab?.id ? ` ${styles.tabActive}` : ''}`}
            onClick={() => { setActiveId(tab.id); onTabChange?.(tab.id); }}
          >
            <span className={styles.tabIcon}>{tab.icon}</span>
            <span className={styles.tabLabel}>{tab.label}</span>
            {tab.badge != null && <span className={styles.tabBadge}>{tab.badge}</span>}
          </button>
        ))}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`panel-${tab.id}`}
          role="tabpanel"
          hidden={tab.id !== activeTab?.id}
          className={styles.panel}
        >
          {tab.panel}
        </div>
      ))}
    </div>
  );
}