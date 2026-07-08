import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useAuth, useIsAdmin } from '../components/auth/context/AuthContext';
import { api } from '../utils/api';

type AdminScopeContextValue = {
  /** True when the current user is an admin and has enabled the superadmin view. */
  scopeAll: boolean;
  /** Toggle the superadmin view. Returns the new state. */
  setScopeAll: (value: boolean) => Promise<boolean>;
  /** True while a preference update is in flight. */
  isUpdating: boolean;
};

const AdminScopeContext = createContext<AdminScopeContextValue | null>(null);

export function useAdminScope(): AdminScopeContextValue {
  const context = useContext(AdminScopeContext);
  if (!context) {
    throw new Error('useAdminScope must be used within an AdminScopeProvider');
  }
  return context;
}

type AdminScopeProviderProps = {
  children: React.ReactNode;
};

export function AdminScopeProvider({ children }: AdminScopeProviderProps) {
  const { token } = useAuth();
  const isAdmin = useIsAdmin();
  const [scopeAll, setScopeAllState] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Load the persisted preference once on mount / token change.
  useEffect(() => {
    if (!token || !isAdmin) {
      setScopeAllState(false);
      setHasLoaded(true);
      return;
    }

    let cancelled = false;
    async function load() {
      try {
        const response = await api.user.preferences();
        if (!response.ok) {
          throw new Error('Failed to load admin scope preference');
        }
        const payload = (await response.json()) as {
          success?: boolean;
          scopeAll?: boolean;
          preferences?: { superadmin_view?: boolean };
        };
        if (!cancelled) {
          setScopeAllState(
            payload.scopeAll ?? payload.preferences?.superadmin_view ?? false,
          );
        }
      } catch (error) {
        console.error('[AdminScope] Failed to load preference:', error);
      } finally {
        if (!cancelled) {
          setHasLoaded(true);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [token, isAdmin]);

  const setScopeAll = useCallback(
    async (value: boolean): Promise<boolean> => {
      if (!isAdmin) {
        return false;
      }
      setIsUpdating(true);
      try {
        const response = await api.user.setPreferences({ superadmin_view: value });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          console.error('[AdminScope] Failed to update preference:', payload);
          return scopeAll;
        }
        const payload = (await response.json()) as {
          success?: boolean;
          scopeAll?: boolean;
          preferences?: { superadmin_view?: boolean };
        };
        const next =
          payload.scopeAll ?? payload.preferences?.superadmin_view ?? value;
        setScopeAllState(next);
        return next;
      } catch (error) {
        console.error('[AdminScope] Error updating preference:', error);
        return scopeAll;
      } finally {
        setIsUpdating(false);
      }
    },
    [isAdmin, scopeAll],
  );

  const value = useMemo<AdminScopeContextValue>(
    () => ({
      scopeAll: isAdmin && scopeAll,
      setScopeAll,
      isUpdating: isUpdating || !hasLoaded,
    }),
    [isAdmin, scopeAll, setScopeAll, isUpdating, hasLoaded],
  );

  return (
    <AdminScopeContext.Provider value={value}>
      {children}
    </AdminScopeContext.Provider>
  );
}

export default AdminScopeContext;
