import { useState, useRef, useEffect } from 'react';
import { Menu, Maximize, Minimize, Bell, User as UserIcon, LogOut, Settings } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import Link from 'next/link';
import styles from './Navbar.module.css';
import { usePathname } from 'next/navigation';

interface NavbarProps {
  onToggleSidebar: () => void;
}

export function Navbar({ onToggleSidebar }: NavbarProps) {
  const { admin, logout } = useAuth();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  // Mock notifications
  const notifications = [
    { id: 1, text: 'New user registered', time: '2 minutes ago' },
    { id: 2, text: 'New support ticket', time: '10 minutes ago' },
    { id: 3, text: 'Subscription renewed', time: '1 hour ago' },
  ];

  const getPageTitle = () => {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length < 2) return 'Dashboard';
    const last = parts[parts.length - 1];
    return last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, ' ');
  };

  return (
    <header className={styles.navbar}>
      <div className={styles.left}>
        <button className={styles.iconBtn} onClick={onToggleSidebar} title="Toggle Sidebar">
          <Menu size={24} />
        </button>
        <h2 className={styles.pageTitle}>{getPageTitle()}</h2>
      </div>

      <div className={styles.right}>
        <button 
          className={styles.iconBtn} 
          onClick={toggleFullscreen} 
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        >
          {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
        </button>

        <div className={styles.relative} ref={notificationsRef}>
          <button 
            className={styles.iconBtn} 
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <Bell size={20} />
            <span className={styles.badge}>{notifications.length}</span>
          </button>

          <div className={`${styles.dropdown} ${showNotifications ? styles.show : ''}`}>
            <div className={styles.dropdownHeader}>Notifications</div>
            <div className={styles.notificationList}>
              {notifications.map(n => (
                <div key={n.id} className={styles.notificationItem}>
                  <div className={styles.notificationText}>{n.text}</div>
                  <div className={styles.notificationTime}>{n.time}</div>
                </div>
              ))}
            </div>
            <div className={styles.dropdownFooter}>View all notifications</div>
          </div>
        </div>

        <div className={styles.relative} ref={profileMenuRef}>
          <button 
            className={styles.profileBtn}
            onClick={() => setShowProfileMenu(!showProfileMenu)}
          >
            <div className={styles.avatar}>
              {admin?.avatar ? (
                <img 
                  src={admin.avatar} 
                  alt={admin.name || 'Avatar'} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} 
                />
              ) : (
                admin?.name ? admin.name.charAt(0).toUpperCase() : 'U'
              )}
            </div>
            <div className={styles.profileInfo}>
              <span className={styles.profileName}>{admin?.name || 'User'}</span>
              <span className={styles.profileRole}>{admin?.roleId.replace('role_', '').replace('_', ' ')}</span>
            </div>
            <span className={styles.arrow}>▼</span>
          </button>

          <div className={`${styles.dropdown} ${styles.profileDropdown} ${showProfileMenu ? styles.show : ''}`}>
            <div className={styles.dropdownHeader}>
              <strong>{admin?.name}</strong>
              <br/>
              <small>{admin?.email}</small>
            </div>
            <Link href="/admin/profile" className={styles.dropdownItem} onClick={() => setShowProfileMenu(false)}>
              <UserIcon size={16} /> Profile
            </Link>
            <Link href="/admin/settings" className={styles.dropdownItem} onClick={() => setShowProfileMenu(false)}>
              <Settings size={16} /> Settings
            </Link>
            <div className={styles.divider}></div>
            <button className={styles.dropdownItem} onClick={() => { setShowProfileMenu(false); logout(); }}>
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
