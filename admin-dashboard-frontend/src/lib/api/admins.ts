import { fetchApi } from './api';
import { Admin } from '../../types/admin';
import { getAuthToken } from './api';

const getApiBaseUrl = () =>
  typeof window !== 'undefined' ? 'http://localhost:3001' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');

export async function getAdmins(): Promise<Admin[]> {
  return await fetchApi<Admin[]>('/admins');
}

export async function getAdmin(id: string): Promise<Admin> {
  return await fetchApi<Admin>(`/admins/${id}`);
}

export async function createAdmin(data: Omit<Admin, 'id'>): Promise<Admin> {
  const newAdmin: Admin = {
    ...data,
    id: `admin_${Date.now()}`,
    createdAt: new Date().toISOString(),
  };

  return await fetchApi<Admin>('/admins', {
    method: 'POST',
    body: JSON.stringify(newAdmin),
  });
}

export async function updateAdmin(id: string, data: Partial<Admin>): Promise<Admin> {
  return await fetchApi<Admin>(`/admins/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteAdmin(id: string): Promise<void> {
  await fetchApi(`/admins/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Upload the current admin's profile picture.
 * Returns the updated Admin object (with the new avatar URL).
 */
export async function uploadAdminAvatar(file: File): Promise<Admin> {
  const formData = new FormData();
  formData.append('avatar', file);

  const response = await fetch(`${getApiBaseUrl()}/auth/me/avatar`, {
    method: 'POST',
    headers: getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {},
    body: formData,
  });

  if (!response.ok) {
    let message = `Upload failed: ${response.statusText}`;
    try {
      const body = await response.json();
      if (body?.message) message = body.message;
    } catch { /* ignore */ }
    throw new Error(message);
  }

  return response.json() as Promise<Admin>;
}
