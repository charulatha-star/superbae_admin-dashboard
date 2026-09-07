import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { usePermissions } from '../../../hooks/usePermissions';
import {
    Home, Users, Globe, UserCheck, Calendar, Navigation,
    FileText, Heart, Star, Lightbulb, Image as ImageIcon,
    Bot, Activity, Settings as SettingsIcon,
    CreditCard, DollarSign, PieChart, LifeBuoy,
    BarChart, TrendingUp, Shield, Flag, ShieldAlert,
    UserCog, Key, ClipboardList, Lock,
    LogOut, User, MessageSquare, Tag, CheckCircle, BookOpen, Link2, Bell, Smartphone, Ban
} from 'lucide-react';
import styles from './Sidebar.module.css';

interface SidebarProps {
    isExpanded: boolean;
    isMobileOpen: boolean;
    onCloseMobile: () => void;
}

export function Sidebar({ isExpanded, isMobileOpen, onCloseMobile }: SidebarProps) {
    const pathname = usePathname();
    const { admin, logout } = useAuth();
    const { hasPermission } = usePermissions();

    const navigation = [
        {
            section: 'DASHBOARD',
            items: [
                { name: 'Dashboard', href: '/admin/dashboard', icon: Home, permission: '*' },
            ],
        },
        {
            section: 'MANAGEMENT',
            items: [
                { name: 'Users', href: '/admin/users', icon: Users, permission: 'users.view' },
                { name: 'Community', href: '/admin/community', icon: Globe, permission: 'posts.view' },
                // { name: 'Posts', href: '/admin/community/posts', icon: FileText, permission: 'posts.view' },
                // { name: 'Comments', href: '/admin/community/comments', icon: MessageSquare, permission: 'posts.view' },
                // { name: 'Reported Posts', href: '/admin/community/reported/posts', icon: Flag, permission: 'posts.view' },
                // { name: 'Reported Comments', href: '/admin/community/reported/comments', icon: Flag, permission: 'posts.view' },
                // { name: 'Moderation Queue', href: '/admin/community/moderation', icon: ShieldAlert, permission: 'posts.view' },
                // { name: 'Blocked Users', href: '/admin/community/blocked', icon: Ban, permission: 'users.view' },
                { name: 'Anonymous', href: '/admin/community/anonymous', icon: MessageSquare, permission: 'posts.view' },
                { name: 'Groups', href: '/admin/groups', icon: UserCheck, permission: 'groups.view' },
                { name: 'Events', href: '/admin/events', icon: Calendar, permission: 'events.view' },
                { name: 'Trips', href: '/admin/trips', icon: Navigation, permission: 'events.view' },
                { name: 'Partners', href: '/admin/community/partners', icon: Link2, permission: 'users.view' },
            ],
        },
        {
            section: 'CONTENT',
            items: [
                { name: 'CMS', href: '/admin/content', icon: FileText, permission: 'cms.view' },
                // { name: 'Affirmations', href: '/admin/content/affirmations', icon: Heart, permission: 'affirmations.manage' },
                // { name: 'Zodiac', href: '/admin/content/zodiac', icon: Star, permission: 'zodiac.manage' },
                // { name: 'Tips', href: '/admin/content/tips', icon: Lightbulb, permission: 'tips.manage' },
                // { name: 'Banners', href: '/admin/content/banners', icon: ImageIcon, permission: 'banners.manage' },
                { name: 'Wardrobe', href: '/admin/content/wardrobe', icon: Tag, permission: 'cms.view' },
                // { name: 'Journal', href: '/admin/content/journal', icon: BookOpen, permission: 'cms.view' },
            ],
        },
        {
            section: 'AI',
            items: [
                { name: 'AI Dashboard', href: '/admin/ai/dashboard', icon: Bot, permission: 'ai.view' },
                { name: 'AI Usage', href: '/admin/ai/usage', icon: Activity, permission: 'ai.view' },
                { name: 'AI Configuration', href: '/admin/ai/config', icon: SettingsIcon, permission: 'ai.configure' },
            ],
        },
        {
            section: 'FINANCE',
            items: [
                { name: 'Subscriptions', href: '/admin/finance/subscriptions', icon: CreditCard, permission: 'subscriptions.view' },
                { name: 'Payments', href: '/admin/finance/payments', icon: DollarSign, permission: 'payments.view' },
                { name: 'Revenue', href: '/admin/finance/revenue', icon: PieChart, permission: 'revenue.view' },
            ],
        },
        {
            section: 'SUPPORT',
            items: [
                { name: 'Tickets', href: '/admin/support', icon: LifeBuoy, permission: 'support.view' },
            ],
        },
        {
            section: 'MARKETING',
            items: [
                { name: 'Notifications', href: '/admin/notifications', icon: Bell, permission: 'users.view' },
            ],
        },
        {
            section: 'ANALYTICS',
            items: [
                { name: 'User Analytics', href: '/admin/analytics/users', icon: BarChart, permission: 'analytics.users' },
                { name: 'Feature Usage', href: '/admin/analytics/features', icon: TrendingUp, permission: 'analytics.features' },
                { name: 'Revenue Analytics', href: '/admin/analytics/revenue', icon: PieChart, permission: 'analytics.revenue' },
            ],
        },
        {
            section: 'SAFETY',
            items: [
                { name: 'Reports', href: '/admin/safety/reports', icon: Flag, permission: 'reports.view' },
                { name: 'Moderation', href: '/admin/safety/moderation', icon: ShieldAlert, permission: 'reports.resolve' },
            ],
        },
        {
            section: 'ADMINISTRATION',
            items: [
                { name: 'Admin Users', href: '/admin/admins', icon: UserCog, permission: 'admins.view' },
                { name: 'Roles & Permissions', href: '/admin/roles', icon: Key, permission: 'roles.view' },
                { name: 'Audit Logs', href: '/admin/audit-logs', icon: ClipboardList, permission: 'audit_logs.view' },
                { name: 'Security', href: '/admin/security', icon: Shield, permission: 'security.view' },
                { name: 'App Settings', href: '/admin/settings/app', icon: Smartphone, permission: 'security.view' },
                { name: 'Trackers', href: '/admin/settings/trackers', icon: CheckCircle, permission: 'security.view' },
            ],
        },
    ];

    const allNavItems = navigation.flatMap(s => s.items);
    const activeHref = allNavItems
        .filter(item => pathname === item.href || pathname.startsWith(item.href + '/'))
        .sort((a, b) => b.href.length - a.href.length)[0]?.href;

    return (
        <>
            <div
                className={`${styles.overlay} ${isMobileOpen ? styles.overlayOpen : ''}`}
                onClick={onCloseMobile}
            />
            <aside
                className={`${styles.sidebar} ${isExpanded ? styles.expanded : styles.collapsed} ${isMobileOpen ? styles.mobileOpen : ''
                    }`}
            >
                <div className={styles.header}>
                    <div className={styles.logo}>
                        <div className={styles.logoIcon}>
                            <img src="/logo-black.svg" alt="Logo" />
                        </div>
                        {/* {isExpanded && <span className={styles.logoText}>ADMIN PANEL</span>} */}
                    </div>
                    {/* {isExpanded && admin && (
            <div className={styles.adminInfo}>
              <div className={styles.adminName}>{admin.name}</div>
              <div className={styles.adminRole}>{admin.email}</div>
            </div>
          )} */}
                </div>

                <nav className={styles.nav}>
                    {navigation.map((section, idx) => {
                        const visibleItems = section.items.filter(item =>
                            item.permission === '*' || hasPermission(item.permission) || hasPermission('*')
                        );

                        if (visibleItems.length === 0) return null;

                        return (
                            <div key={idx} className={styles.section}>
                                {isExpanded && <div className={styles.sectionTitle}>{section.section}</div>}
                                {visibleItems.map(item => {
                                    const Icon = item.icon;
                                    const isActive = item.href === activeHref;

                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            onClick={onCloseMobile}
                                            className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                                            title={!isExpanded ? item.name : undefined}
                                        >
                                            <Icon className={styles.navIcon} size={20} />
                                            {isExpanded && <span className={styles.navText}>{item.name}</span>}
                                        </Link>
                                    );
                                })}
                            </div>
                        );
                    })}
                </nav>

                <div className={styles.footer}>
                    {/* <Link
                        href="/admin/settings"
                        className={styles.navItem}
                        title={!isExpanded ? 'Settings' : undefined}
                    >
                        <SettingsIcon className={styles.navIcon} size={20} />
                        {isExpanded && <span className={styles.navText}>Settings</span>}
                    </Link>
                    <Link
                        href="/admin/profile"
                        className={styles.navItem}
                        title={!isExpanded ? 'My Profile' : undefined}
                    >
                        <User className={styles.navIcon} size={20} />
                        {isExpanded && <span className={styles.navText}>My Profile</span>}
                    </Link> */}
                    <button
                        onClick={logout}
                        className={styles.navItem}
                        title={!isExpanded ? 'Logout' : undefined}
                    >
                        <LogOut className={styles.navIcon} size={20} />
                        {isExpanded && <span className={styles.navText}>Logout</span>}
                    </button>
                </div>
            </aside>
        </>
    );
}
