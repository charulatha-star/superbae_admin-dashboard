import { fetchApi } from './api';
import { Admin } from '../../types/admin';

export async function loginAdmin(email: string, password?: string): Promise<Admin | null> {
  return await fetchApi<Admin>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function getCurrentAdmin(): Promise<Admin | null> {
  try {
    return await fetchApi<Admin | null>('/auth/me');
  } catch (err) {
    console.error('Error fetching current admin:', err);
  }
  return null;
}

export async function logoutAdmin(): Promise<void> {
  await fetchApi('/auth/logout', {
    method: 'POST',
  });
}

export async function registerAdmin(data: Partial<Admin>): Promise<Admin> {
  const newAdmin = {
    id: `admin_${Date.now()}`,
    name: data.name || '',
    email: data.email || '',
    password: data.password || '',
    roleId: data.roleId || 'role_operations',
    status: 'active' as const,
    twoFactorEnabled: false,
    createdAt: new Date().toISOString(),
  };

  return await fetchApi<Admin>('/admins', {
    method: 'POST',
    body: JSON.stringify(newAdmin),
  });
}
