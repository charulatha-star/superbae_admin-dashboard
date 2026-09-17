/**
 * Phase 4 CMS configuration.
 *
 * Single source of truth for the Create/Edit form and the Detail/View page of
 * every content collection exposed by the CMS hub. Each resource maps to the
 * dedicated content-management API routes
 * (POST/PATCH/DELETE /{resource}, POST /{resource}/:id/publish|unpublish).
 */

export type ContentFieldType = 'text' | 'textarea' | 'select' | 'date' | 'number' | 'checkbox';

export interface ContentFieldOption {
  value: string;
  label: string;
}

export interface ContentField {
  name: string;
  label: string;
  type: ContentFieldType;
  required?: boolean;
  options?: ContentFieldOption[];
  placeholder?: string;
  helpText?: string;
  rows?: number;
}

export interface ContentDetailField {
  name: string;
  label: string;
  format?: 'date' | 'datetime' | 'boolean';
}

export type ContentResourceKey =
  | 'tips'
  | 'affirmations'
  | 'banners'
  | 'journalPrompts'
  | 'zodiac'
  | 'fortuneCookies'
  | 'communityGuidelines'
  | 'appAnnouncements';

export interface ContentResourceConfig {
  key: ContentResourceKey;
  /** API path used by the content-management router. */
  apiPath: string;
  /** Admin UI list page. */
  listHref: string;
  singular: string;
  plural: string;
  description: string;
  /** Field used as the detail page heading. */
  titleField: string;
  searchPlaceholder: string;
  fields: ContentField[];
  detailFields: ContentDetailField[];
}

export const ZODIAC_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];

const STATUS_FIELD: ContentField = {
  name: 'status',
  label: 'Status',
  type: 'select',
  options: [
    { value: 'draft', label: 'Draft' },
    { value: 'published', label: 'Published' },
    { value: 'archived', label: 'Archived' },
  ],
  helpText: 'Publishing and unpublishing require the CONTENT_PUBLISH permission.',
};

const FEATURED_FIELD: ContentField = {
  name: 'isFeatured',
  label: 'Featured',
  type: 'checkbox',
  helpText: 'Highlight this item on the platform.',
};

export const contentConfigs: Record<ContentResourceKey, ContentResourceConfig> = {
  tips: {
    key: 'tips',
    apiPath: '/tips',
    listHref: '/admin/content/tips',
    singular: 'Tip',
    plural: 'Wellness Tips',
    description: 'Manage health and wellness tip content.',
    titleField: 'title',
    searchPlaceholder: 'Search tips...',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'e.g. Morning Meditation for Mental Clarity' },
      {
        name: 'subtype',
        label: 'Subtype',
        type: 'select',
        required: true,
        options: [
          { value: 'wellness', label: 'Wellness' },
          { value: 'relationship', label: 'Relationship' },
        ],
        helpText: 'Determines which app section the tip appears in.',
      },
      { name: 'category', label: 'Category', type: 'text', placeholder: 'e.g. Wellness' },
      { name: 'body', label: 'Body', type: 'textarea', required: true, rows: 6, placeholder: 'Write the full tip content...' },
      STATUS_FIELD,
      FEATURED_FIELD,
    ],
    detailFields: [
      { name: 'title', label: 'Title' },
      { name: 'subtype', label: 'Subtype' },
      { name: 'category', label: 'Category' },
      { name: 'status', label: 'Status' },
      { name: 'isFeatured', label: 'Featured', format: 'boolean' },
      { name: 'views', label: 'Views' },
      { name: 'authorId', label: 'Author ID' },
      { name: 'createdAt', label: 'Created', format: 'datetime' },
      { name: 'updatedAt', label: 'Last updated', format: 'datetime' },
      { name: 'publishedAt', label: 'Published at', format: 'datetime' },
    ],
  },
  affirmations: {
    key: 'affirmations',
    apiPath: '/affirmations',
    listHref: '/admin/content/affirmations',
    singular: 'Affirmation',
    plural: 'Affirmations',
    description: 'Manage daily affirmation content.',
    titleField: 'text',
    searchPlaceholder: 'Search affirmations...',
    fields: [
      { name: 'text', label: 'Affirmation', type: 'textarea', required: true, rows: 4, placeholder: 'e.g. I am worthy of love and belonging.' },
      { name: 'category', label: 'Category', type: 'text', placeholder: 'e.g. Self-Love' },
      STATUS_FIELD,
      FEATURED_FIELD,
    ],
    detailFields: [
      { name: 'text', label: 'Affirmation' },
      { name: 'category', label: 'Category' },
      { name: 'status', label: 'Status' },
      { name: 'isFeatured', label: 'Featured', format: 'boolean' },
      { name: 'createdAt', label: 'Created', format: 'datetime' },
      { name: 'updatedAt', label: 'Last updated', format: 'datetime' },
      { name: 'publishedAt', label: 'Published at', format: 'datetime' },
    ],
  },
  banners: {
    key: 'banners',
    apiPath: '/banners',
    listHref: '/admin/content/banners',
    singular: 'Banner',
    plural: 'Banners',
    description: 'Manage promotional banners across the platform.',
    titleField: 'title',
    searchPlaceholder: 'Search banners...',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'e.g. Premium Upgrade Banner' },
      {
        name: 'type',
        label: 'Type',
        type: 'select',
        options: [
          { value: 'banner', label: 'Banner' },
          { value: 'promotional', label: 'Promotional' },
        ],
      },
      { name: 'placement', label: 'Placement', type: 'text', placeholder: 'e.g. home_top', helpText: 'Where the banner is rendered in the app.' },
      { name: 'imageUrl', label: 'Image URL', type: 'text', placeholder: '/banners/premium.jpg' },
      { name: 'linkUrl', label: 'Link URL', type: 'text', placeholder: '/upgrade' },
      { name: 'startDate', label: 'Start date', type: 'date' },
      { name: 'endDate', label: 'End date', type: 'date' },
      STATUS_FIELD,
      FEATURED_FIELD,
    ],
    detailFields: [
      { name: 'title', label: 'Title' },
      { name: 'type', label: 'Type' },
      { name: 'placement', label: 'Placement' },
      { name: 'imageUrl', label: 'Image URL' },
      { name: 'linkUrl', label: 'Link URL' },
      { name: 'startDate', label: 'Start date', format: 'date' },
      { name: 'endDate', label: 'End date', format: 'date' },
      { name: 'status', label: 'Status' },
      { name: 'isFeatured', label: 'Featured', format: 'boolean' },
      { name: 'clicks', label: 'Clicks' },
      { name: 'impressions', label: 'Impressions' },
      { name: 'createdAt', label: 'Created', format: 'datetime' },
      { name: 'updatedAt', label: 'Last updated', format: 'datetime' },
    ],
  },
  journalPrompts: {
    key: 'journalPrompts',
    apiPath: '/journalPrompts',
    listHref: '/admin/content/journal',
    singular: 'Journal Prompt',
    plural: 'Journal Prompts',
    description: 'Manage daily journal prompts and mental wellness insights.',
    titleField: 'text',
    searchPlaceholder: 'Search prompts...',
    fields: [
      { name: 'text', label: 'Prompt text', type: 'textarea', required: true, rows: 4, placeholder: 'e.g. What made you smile today?' },
      { name: 'category', label: 'Category', type: 'text', placeholder: 'e.g. Gratitude' },
      STATUS_FIELD,
      FEATURED_FIELD,
    ],
    detailFields: [
      { name: 'text', label: 'Prompt text' },
      { name: 'category', label: 'Category' },
      { name: 'status', label: 'Status' },
      { name: 'isFeatured', label: 'Featured', format: 'boolean' },
      { name: 'createdAt', label: 'Created', format: 'datetime' },
      { name: 'updatedAt', label: 'Last updated', format: 'datetime' },
      { name: 'publishedAt', label: 'Published at', format: 'datetime' },
    ],
  },
  zodiac: {
    key: 'zodiac',
    apiPath: '/zodiac',
    listHref: '/admin/content/zodiac',
    singular: 'Zodiac Entry',
    plural: 'Zodiac Content',
    description: 'Manage daily horoscope and zodiac content.',
    titleField: 'sign',
    searchPlaceholder: 'Search zodiac sign...',
    fields: [
      {
        name: 'sign',
        label: 'Sign',
        type: 'select',
        required: true,
        options: ZODIAC_SIGNS.map((sign) => ({ value: sign, label: sign })),
      },
      { name: 'date', label: 'Date', type: 'date', required: true, helpText: 'The reading date for this sign.' },
      { name: 'horoscope', label: 'Horoscope', type: 'textarea', rows: 4, placeholder: 'Today brings fresh energy...' },
      { name: 'love', label: 'Love', type: 'textarea', rows: 3 },
      { name: 'career', label: 'Career', type: 'textarea', rows: 3 },
      STATUS_FIELD,
      FEATURED_FIELD,
    ],
    detailFields: [
      { name: 'sign', label: 'Sign' },
      { name: 'date', label: 'Date', format: 'date' },
      { name: 'status', label: 'Status' },
      { name: 'isFeatured', label: 'Featured', format: 'boolean' },
      { name: 'horoscope', label: 'Horoscope' },
      { name: 'love', label: 'Love' },
      { name: 'career', label: 'Career' },
      { name: 'createdAt', label: 'Created', format: 'datetime' },
      { name: 'updatedAt', label: 'Last updated', format: 'datetime' },
    ],
  },
  fortuneCookies: {
    key: 'fortuneCookies',
    apiPath: '/fortuneCookies',
    listHref: '/admin/content/fortune',
    singular: 'Fortune Cookie',
    plural: 'Fortune Cookies',
    description: 'Manage daily fortune cookie messages.',
    titleField: 'text',
    searchPlaceholder: 'Search fortunes...',
    fields: [
      { name: 'text', label: 'Fortune text', type: 'textarea', required: true, rows: 4, placeholder: 'e.g. Good things come to those who wait.' },
      { name: 'category', label: 'Category', type: 'text', placeholder: 'e.g. Luck' },
      STATUS_FIELD,
      FEATURED_FIELD,
    ],
    detailFields: [
      { name: 'text', label: 'Fortune text' },
      { name: 'category', label: 'Category' },
      { name: 'status', label: 'Status' },
      { name: 'isFeatured', label: 'Featured', format: 'boolean' },
      { name: 'createdAt', label: 'Created', format: 'datetime' },
      { name: 'updatedAt', label: 'Last updated', format: 'datetime' },
      { name: 'publishedAt', label: 'Published at', format: 'datetime' },
    ],
  },
  communityGuidelines: {
    key: 'communityGuidelines',
    apiPath: '/communityGuidelines',
    listHref: '/admin/content/guidelines',
    singular: 'Community Guideline',
    plural: 'Community Guidelines',
    description: 'Manage community rules and guidelines content.',
    titleField: 'title',
    searchPlaceholder: 'Search guidelines...',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'e.g. Be kind and respectful' },
      { name: 'body', label: 'Body', type: 'textarea', required: true, rows: 6, placeholder: 'Write the full guideline text...' },
      { name: 'order', label: 'Display order', type: 'number', helpText: 'Lower numbers appear first (0 = default).' },
      STATUS_FIELD,
      FEATURED_FIELD,
    ],
    detailFields: [
      { name: 'title', label: 'Title' },
      { name: 'body', label: 'Body' },
      { name: 'order', label: 'Display order' },
      { name: 'status', label: 'Status' },
      { name: 'isFeatured', label: 'Featured', format: 'boolean' },
      { name: 'createdAt', label: 'Created', format: 'datetime' },
      { name: 'updatedAt', label: 'Last updated', format: 'datetime' },
      { name: 'publishedAt', label: 'Published at', format: 'datetime' },
    ],
  },
  appAnnouncements: {
    key: 'appAnnouncements',
    apiPath: '/appAnnouncements',
    listHref: '/admin/content/announcements',
    singular: 'Announcement',
    plural: 'App Announcements',
    description: 'Manage in-app announcements and platform notices.',
    titleField: 'title',
    searchPlaceholder: 'Search announcements...',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'e.g. Scheduled maintenance this weekend' },
      { name: 'body', label: 'Body', type: 'textarea', required: true, rows: 6, placeholder: 'Write the full announcement text...' },
      {
        name: 'severity',
        label: 'Severity',
        type: 'select',
        options: [
          { value: 'info', label: 'Info' },
          { value: 'warning', label: 'Warning' },
          { value: 'critical', label: 'Critical' },
        ],
        helpText: 'How prominently the announcement is surfaced in the app.',
      },
      STATUS_FIELD,
      FEATURED_FIELD,
    ],
    detailFields: [
      { name: 'title', label: 'Title' },
      { name: 'body', label: 'Body' },
      { name: 'severity', label: 'Severity' },
      { name: 'status', label: 'Status' },
      { name: 'isFeatured', label: 'Featured', format: 'boolean' },
      { name: 'createdAt', label: 'Created', format: 'datetime' },
      { name: 'updatedAt', label: 'Last updated', format: 'datetime' },
      { name: 'publishedAt', label: 'Published at', format: 'datetime' },
    ],
  },
};

export function getContentConfig(key: string): ContentResourceConfig {
  const config = contentConfigs[key as ContentResourceKey];
  if (!config) throw new Error(`Unknown content resource: ${key}`);
  return config;
}