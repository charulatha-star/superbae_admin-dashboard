'use client';

import { Tabs, type TabItem } from '../../../components/admin/Tabs/Tabs';
import { ConfigManager } from '../content/wardrobe/components/ConfigManager';
import styles from '../users/page.module.css'; // Reusing standard page layout styles

export default function PartnersPage() {
  // Panels for each tab
  const connectionsPanel = (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <ConfigManager resourcePath="partnerConnections" title="Partner Connections" itemName="Connection" />
      <ConfigManager resourcePath="connectionRequests" title="Connection Requests" itemName="Request" />
    </div>
  );

  const usageReportsPanel = (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <ConfigManager resourcePath="relationshipUsage" title="Relationship Feature Usage" itemName="Usage Record" />
      <ConfigManager resourcePath="sharedSpaceReports" title="Shared-Space Reports" itemName="Report" />
      <ConfigManager resourcePath="coupleContent" title="Couple Content Reports" itemName="Content" />
    </div>
  );

  const plannerPanel = (
    <div style={{ padding: '1rem' }}>
      <ConfigManager resourcePath="datePlanner" title="Date Planner Content" itemName="Plan" />
    </div>
  );

  const remindersTipsPanel = (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <ConfigManager resourcePath="anniversaryReminders" title="Anniversary & Reminder Templates" itemName="Template" />
      <ConfigManager resourcePath="tips" title="Relationship Tips" itemName="Tip" />
    </div>
  );

  const tabs: TabItem[] = [
    { id: 'connections', label: 'Connections', panel: connectionsPanel },
    { id: 'usage-reports', label: 'Usage & Reports', panel: usageReportsPanel },
    { id: 'planner', label: 'Date Planner', panel: plannerPanel },
    { id: 'reminders', label: 'Reminders & Tips', panel: remindersTipsPanel },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Partner Feature Dashboard</h1>
      </div>
      <Tabs tabs={tabs} defaultTab="connections" ariaLabel="Partner features sections" />
    </div>
  );
}
