// src/components/admin/NoData/NoData.tsx
import styles from './NoData.module.css';

interface NoDataProps {
  title?: string;
  description?: string;
}

export function NoData({ title = 'No data', description = 'No records are available to display.' }: NoDataProps) {
  return (
    <div className={styles.wrapper}>
      <svg
        className={styles.image}
        viewBox="0 0 200 170"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Background blob */}
        <circle cx="100" cy="88" r="72" fill="url(#ng1)" opacity="0.35" />

        {/* Box */}
        <rect x="46" y="72" width="108" height="74" rx="10" fill="#ffffff" stroke="#F472B6" strokeWidth="4" />
        <path d="M46 88 L100 112 L154 88" stroke="#F472B6" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M100 112 L100 140" stroke="#F78BC0" strokeWidth="4" strokeLinecap="round" />

        {/* Documents inside */}
        <rect x="70" y="66" width="34" height="40" rx="5" fill="#FBCFE8" stroke="#EC4899" strokeWidth="3" transform="rotate(-8 87 86)" />
        <rect x="102" y="62" width="34" height="40" rx="5" fill="#FCE7F3" stroke="#F472B6" strokeWidth="3" transform="rotate(6 119 82)" />

        {/* Empty search / magnifier */}
        <circle cx="152" cy="50" r="18" stroke="#EC4899" strokeWidth="5" fill="#FFF0F6" />
        <line x1="165" y1="63" x2="176" y2="74" stroke="#EC4899" strokeWidth="5" strokeLinecap="round" />

        <defs>
          <linearGradient id="ng1" x1="28" y1="16" x2="172" y2="160" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FBCFE8" />
            <stop offset="1" stopColor="#FCE7F3" />
          </linearGradient>
        </defs>
      </svg>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.description}>{description}</p>
    </div>
  );
}