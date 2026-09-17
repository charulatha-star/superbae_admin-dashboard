'use client';

import Link from 'next/link';
import { FileText, Star, Lightbulb, Image, BookOpen } from 'lucide-react';
import styles from '../community/page.module.css';

const sections = [
  { href: '/admin/content/affirmations', icon: Star, label: 'Affirmations', desc: 'Manage daily affirmation content', color: '#7c3aed' },
  { href: '/admin/content/zodiac', icon: Star, label: 'Zodiac', desc: 'Manage zodiac horoscope content', color: '#d97706' },
  { href: '/admin/content/tips', icon: Lightbulb, label: 'Wellness Tips', desc: 'Manage health and wellness tips', color: '#16a34a' },
  { href: '/admin/content/banners', icon: Image, label: 'Banners', desc: 'Manage promotional banners', color: '#0891b2' },
  { href: '/admin/content/journal', icon: BookOpen, label: 'journal', desc: 'Manage journal content', color: '#f17ec5' },
];

export default function ContentPage() {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Content Management</h1>
        <p className={styles.subtitle}>Manage all platform content including affirmations, zodiac, tips, and banners.</p>
      </div>
      <div className={styles.grid}>
        {sections.map(({ href, icon: Icon, label, desc, color }) => (
          <Link key={href} href={href} className={styles.card}>
            <div className={styles.iconWrapper} style={{ backgroundColor: `${color}15` }}>
              <Icon size={28} style={{ color }} />
            </div>
            <div className={styles.cardContent}>
              <h3 className={styles.cardTitle}>{label}</h3>
              <p className={styles.cardDesc}>{desc}</p>
            </div>
            <span className={styles.arrow}>→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
