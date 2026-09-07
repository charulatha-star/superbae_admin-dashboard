import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { Role } from '../types/role';
import { getRole } from '../lib/api/roles';

// Module-level cache so permissions are available instantly on re-renders
// and navigation, avoiding a flash where gated icons/buttons appear late.
let cachedRoleId: string | null = null;
let cachedRole: Role | null = null;

function readCachedRole(roleId: string): Role | null {
  if (cachedRoleId === roleId && cachedRole) return cachedRole;
  try {
    const raw = sessionStorage.getItem(`role_${roleId}`);
    if (raw) {
      cachedRoleId = roleId;
      cachedRole = JSON.parse(raw) as Role;
      return cachedRole;
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

export function usePermissions() {
  const { admin } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchRole = async (roleId: string) => {
      try {
        const r = await getRole(roleId);
        if (cancelled) return;
        cachedRoleId = roleId;
        cachedRole = r;
        try {
          sessionStorage.setItem(`role_${roleId}`, JSON.stringify(r));
        } catch {
          // storage may be unavailable; cache in memory only
        }
        setRole(r);
      } catch (error) {
        console.error('Error fetching role for permissions', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (admin && admin.roleId) {
      // Serve from cache immediately when available (no loading flash) and
      // skip the network request entirely — avoids a duplicate /roles call.
      const cached = readCachedRole(admin.roleId);
      if (cached) {
        setRole(cached);
        setLoading(false);
      } else {
        fetchRole(admin.roleId);
      }
    } else {
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [admin]);

  const hasPermission = (permission: string): boolean => {
    if (!role) return false;
    if (role.permissions.includes('*')) return true; // Super Admin
    return role.permissions.includes(permission);
  };

  return { hasPermission, role, loading };
}
