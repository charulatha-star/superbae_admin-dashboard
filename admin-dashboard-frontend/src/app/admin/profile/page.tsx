'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { Eye, EyeOff, Upload, User, CheckCircle } from 'lucide-react';
import { Loader } from '../../../components/admin/Loader';
import { Toast } from '../../../components/admin/Toast';
import styles from '../admins/create/page.module.css';

export default function ProfilePage() {
  const { admin, loading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (admin) {
      setName(admin.name);
      setEmail(admin.email);
    }
  }, [admin]);

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Mock upload - create an object URL
      const url = URL.createObjectURL(file);
      setAvatarUrl(url);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password && password !== confirmPassword) {
      setToast({ message: 'Passwords do not match', type: 'error' });
      return;
    }
    
    setIsSubmitting(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      setToast({ message: 'Profile updated successfully', type: 'success' });
      setPassword('');
      setConfirmPassword('');
    }, 800);
  };

  if (loading || !admin) {
    return (
      <div className={styles.container}>
        <div style={{display:'flex',justifyContent:'center',padding:48}}><Loader /></div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}

      <div className={styles.header}>
        <h1 className={styles.title}>My Profile</h1>
        <p className={styles.subtitle}>Update your personal information and settings.</p>
      </div>

      <div className={styles.content}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formSection}>
            <h2 className={styles.sectionTitle}>Profile Picture</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <div 
                style={{
                  width: 100, 
                  height: 100, 
                  borderRadius: '50%', 
                  backgroundColor: '#e5e7eb', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  overflow: 'hidden',
                  position: 'relative',
                  cursor: 'pointer'
                }}
                onClick={handleImageClick}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <User size={48} color="#9ca3af" />
                )}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', padding: '4px' }}>
                  <Upload size={16} color="#fff" />
                </div>
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 500 }}>Upload new avatar</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>JPG, GIF or PNG. Max size of 2MB.</p>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  style={{ display: 'none' }} 
                  accept="image/*"
                  onChange={handleImageChange}
                />
              </div>
            </div>
          </div>

          <div className={styles.formSection}>
            <h2 className={styles.sectionTitle}>Personal Information</h2>
            <div className={styles.grid}>
              <div className={styles.field}>
                <label className={styles.label}>Full Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  className={styles.input} 
                  required 
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Email Address</label>
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className={styles.input} 
                  required 
                />
              </div>
            </div>
          </div>

          <div className={styles.formSection}>
            <h2 className={styles.sectionTitle}>Security</h2>
            <p className={styles.sectionDesc}>Leave blank to keep your current password.</p>
            <div className={styles.grid}>
              <div className={styles.field}>
                <label className={styles.label}>New Password</label>
                <div className={styles.passwordWrapper}>
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={styles.input} 
                  />
                  <button 
                    type="button" 
                    className={styles.eyeBtn} 
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Confirm New Password</label>
                <div className={styles.passwordWrapper}>
                  <input 
                    type={showConfirmPassword ? 'text' : 'password'} 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={styles.input} 
                  />
                  <button 
                    type="button" 
                    className={styles.eyeBtn} 
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.formActions}>
            <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
              {isSubmitting ? <Loader /> : <><CheckCircle size={16} style={{marginRight: '8px'}} /> Save Changes</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
