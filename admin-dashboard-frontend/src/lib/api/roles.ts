import { fetchApi } from './api';
import { Role, Permission } from '../../types/role';

export async function getRoles(): Promise<Role[]> {
  return await fetchApi<Role[]>('/roles');
}

export async function getRole(id: string): Promise<Role> {
  return await fetchApi<Role>(`/roles/${id}`);
}

export async function createRole(data: Omit<Role, 'id'>): Promise<Role> {
  const newRole: Role = {
    ...data,
    id: `role_${Date.now()}`,
  };

  return await fetchApi<Role>('/roles', {
    method: 'POST',
    body: JSON.stringify(newRole),
  });
}

export async function updateRole(id: string, data: Partial<Role>): Promise<Role> {
  return await fetchApi<Role>(`/roles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteRole(id: string): Promise<void> {
  await fetchApi(`/roles/${id}`, {
    method: 'DELETE',
  });
}

export async function getPermissions(): Promise<Permission[]> {
  return await fetchApi<Permission[]>('/permissions');
}
