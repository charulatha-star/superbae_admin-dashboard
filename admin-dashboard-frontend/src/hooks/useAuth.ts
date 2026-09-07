import { useState, useEffect } from 'react';
import { Admin } from '../types/admin';
import { getCurrentAdmin, logoutAdmin as logoutApi } from '../lib/api/auth';
import { clearAuthToken } from '../lib/api/api';
import { useRouter, usePathname } from 'next/navigation';

// ---------------------------------------------------------------------------
// Shared, single-flight auth state.
//
// The admin layout, Navbar, Sidebar, pages and usePermissions() all call
// useAuth(). Without sharing state, every one of them fires its own
// /auth/me request, producing ~6 duplicate calls on a single page load. By
// hoisting the admin state to module level and subscribing components to it,
// only ONE /auth/me request is issued, and every component shares the result.
// ---------------------------------------------------------------------------
let sharedAdmin: Admin | null | undefined; // undefined = not fetched yet
let sharedLoading = true;
let authFetchPromise: Promise<void> | null = null;
const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach((notify) => notify());
}

/** Fetches the current admin once and caches the result for every subscriber. */
async function initSharedAuth(): Promise<void> {
  if (authFetchPromise) return authFetchPromise;

  authFetchPromise = getCurrentAdmin()
    .catch(() => null)
    .then((admin) => {
      sharedAdmin = admin;
      sharedLoading = false;
      notifySubscribers();
    });

  return authFetchPromise;
}

/** Clears the cached session so a fresh /auth/me is issued after logout. */
export function resetAuthState(): void {
  sharedAdmin = undefined;
  sharedLoading = true;
  authFetchPromise = null;
  notifySubscribers();
}

export function useAuth() {
  const router = useRouter();
  const pathname = usePathname();

  const [admin, setAdmin] = useState<Admin | null>(sharedAdmin ?? null);
  const [loading, setLoading] = useState(sharedLoading);

  useEffect(() => {
    const notify = () => {
      setAdmin(sharedAdmin ?? null);
      setLoading(sharedLoading);
    };
    subscribers.add(notify);

    // Start the shared fetch only once, regardless of how many components
    // call useAuth().
    if (sharedAdmin === undefined && !authFetchPromise) {
      void initSharedAuth();
    } else if (sharedAdmin !== undefined) {
      // Already loaded (e.g. component mounted after navigation) — sync now
      // without issuing another request.
      notify();
    }

    return () => {
      subscribers.delete(notify);
    };
  }, []);

  // Redirect based on the shared result once loading has finished.
  useEffect(() => {
    if (loading) return;
    if (!admin && pathname.startsWith('/admin')) {
      router.push('/login');
    } else if (admin && pathname === '/login') {
      router.push('/admin/dashboard');
    }
  }, [loading, admin, pathname, router]);

  const logout = async () => {
    try {
      // Only clear the session/token if the logout API succeeds.
      await logoutApi();
      clearAuthToken();
      sessionStorage.removeItem('admin');
      resetAuthState();
      setAdmin(null);
      router.push('/login');
    } catch (err) {
      // Logout API failed — do NOT clear the token/session so the admin
      // stays logged in.
      console.error('Logout failed:', err);
    }
  };

  return { admin, loading, logout, setAdmin };
}
