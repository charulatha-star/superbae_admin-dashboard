'use client';

import React, { useState, type PropsWithChildren, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './Accordion.module.css';

interface AccordionProps extends PropsWithChildren {
  title: string;
  icon?: ReactNode;
  /** Small pill shown on the right of the header (e.g. an item count). */
  badge?: ReactNode;
  defaultOpen?: boolean;
}

export function Accordion({
  title,
  icon,
  badge,
  defaultOpen = false,
  children,
}: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`${styles.accordion}${open ? ` ${styles.open}` : ''}`}>
      <button
        type="button"
        className={styles.header}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <span className={styles.titleWrap}>
          {icon && <span className={styles.icon}>{icon}</span>}
          <span className={styles.title}>{title}</span>
        </span>
        <span className={styles.right}>
          {badge != null && <span className={styles.badge}>{badge}</span>}
          <ChevronDown size={18} className={styles.chevron} />
        </span>
      </button>
      {open && <div className={styles.body}>{children}</div>}
    </div>
  );
}