'use client';

import { useState } from 'react';
import styles from './trackers.module.css';
import { Tabs, TabItem } from '../../../../components/admin/Tabs/Tabs';
import { TrackersTable } from './components/TrackersTable';
import { OptionManager } from './components/OptionManager';
import { UnitsSettings } from './components/UnitsSettings';
import { OPTION_RESOURCES } from './trackerConfig';

/**
 * Trackers Configuration hub.
 * One Settings -> Trackers entry; every configuration resource is a tab.
 * Reads only require authentication; every write action inside the tab
 * components is wrapped in <PermissionGate permission="TRACKER_CONFIG_MANAGE">.
 */
export default function TrackersSettingsPage() {
  const [activeTab, setActiveTab] = useState('trackers');

  const tabs: TabItem[] = [
    { id: 'trackers', label: 'Trackers', panel: <TrackersTable /> },
    ...OPTION_RESOURCES.map((def) => ({
      id: def.key,
      label: def.tabLabel,
      panel: <OptionManager def={def} />,
    })),
    { id: 'units', label: 'Units', panel: <UnitsSettings /> },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Trackers Configuration</h1>
        <p className={styles.subtitle}>
          Manage the tracker registry, option lists, reminder templates and unit
          settings used across the app.
        </p>
      </div>

      <div className={styles.panel}>
        <Tabs tabs={tabs} ariaLabel="Tracker configuration sections" defaultTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </div>
  );
}