'use client';

import { ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { AdminLayout } from '../../components/admin/AdminLayout/AdminLayout';
import { Loader } from '../../components/admin/Loader';

export default function AppAdminLayout({ children }: { children: ReactNode }) {
  const { admin, loading } = useAuth();

  if (loading) {
    return <Loader fullScreen />;
  }

  // If not admin, the useAuth hook will redirect to /login
  if (!admin) {
    return null; 
  }

  return <AdminLayout>{children}</AdminLayout>;
}
