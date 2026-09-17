import { fetchApi } from './api';
import { Admin } from '../../types/admin';

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
