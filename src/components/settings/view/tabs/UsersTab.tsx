import { useCallback, useEffect, useState } from 'react';
import { Loader2, KeyRound, UserPlus, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../../../auth/context/AuthContext';
import { useAdminScope } from '../../../../contexts/AdminScopeContext';
import SettingsToggle from '../SettingsToggle';

type UserRow = {
  id: number;
  username: string;
  is_active: number;
  created_at: string;
  last_login: string | null;
};

export default function UsersTab() {
  const { t } = useTranslation('settings');
  const { token, user: currentUser } = useAuth();
  const { scopeAll, setScopeAll, isUpdating } = useAdminScope();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create-user form state
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Change-password form state
  const [curPwd, setCurPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [isChangingPwd, setIsChangingPwd] = useState(false);

  const handleToggleScopeAll = useCallback(async () => {
    setError('');
    setSuccess('');
    const next = await setScopeAll(!scopeAll);
    setSuccess(next ? 'Superadmin view enabled' : 'Superadmin view disabled');
  }, [scopeAll, setScopeAll]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load users');
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch {
      setError('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setSuccess('');

      if (!newUsername.trim() || !newPassword) {
        setError('Username and password are required');
        return;
      }
      if (newUsername.trim().length < 3 || newPassword.length < 6) {
        setError('Username ≥ 3 chars, password ≥ 6 chars');
        return;
      }

      setIsCreating(true);
      try {
        const res = await fetch('/api/auth/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ username: newUsername.trim(), password: newPassword }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Failed to create user');
        } else {
          setSuccess(`User "${data.user.username}" created`);
          setNewUsername('');
          setNewPassword('');
          void fetchUsers();
        }
      } catch {
        setError('Network error');
      } finally {
        setIsCreating(false);
      }
    },
    [newUsername, newPassword, token, fetchUsers],
  );

  const handleChangePassword = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setSuccess('');

      if (!curPwd || !newPwd) {
        setError('All fields are required');
        return;
      }
      if (newPwd.length < 6) {
        setError('New password must be at least 6 characters');
        return;
      }
      if (newPwd !== confirmPwd) {
        setError('New passwords do not match');
        return;
      }

      setIsChangingPwd(true);
      try {
        const res = await fetch('/api/auth/password', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ currentPassword: curPwd, newPassword: newPwd }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Failed to change password');
        } else {
          setSuccess('Password changed successfully');
          setCurPwd('');
          setNewPwd('');
          setConfirmPwd('');
        }
      } catch {
        setError('Network error');
      } finally {
        setIsChangingPwd(false);
      }
    },
    [curPwd, newPwd, confirmPwd, token],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Superadmin scope toggle */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              Superadmin View
            </h3>
            <p className="text-xs text-muted-foreground">
              When enabled, you can view and manage all users&apos; projects and sessions.
              New sessions cannot be created in this mode.
            </p>
          </div>
          <SettingsToggle
            checked={scopeAll}
            onChange={handleToggleScopeAll}
            ariaLabel="Toggle superadmin view"
            disabled={isUpdating}
          />
        </div>
      </section>

      {/* Change own password */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="h-4 w-4" />
          Change Password
        </h3>
        <form onSubmit={handleChangePassword} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">Current Password</label>
            <input
              type="password"
              value={curPwd}
              onChange={(e) => setCurPwd(e.target.value)}
              placeholder="••••••"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              disabled={isChangingPwd}
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">New Password</label>
            <input
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              placeholder="••••••"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              disabled={isChangingPwd}
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">Confirm New Password</label>
            <input
              type="password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              placeholder="••••••"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              disabled={isChangingPwd}
            />
          </div>
          <button
            type="submit"
            disabled={isChangingPwd}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {isChangingPwd ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Update
          </button>
        </form>
      </section>

      {/* Create new user */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <UserPlus className="h-4 w-4" />
          Create New User
        </h3>
        <form onSubmit={handleCreate} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">Username</label>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="new-user"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              disabled={isCreating}
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              disabled={isCreating}
            />
          </div>
          <button
            type="submit"
            disabled={isCreating}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Create
          </button>
        </form>
      </section>

      {/* User list */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold">Users ({users.length})</h3>
        <div className="space-y-2">
          {users.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-2.5"
            >
              <div className="flex items-center gap-3">
                <span className="font-medium text-sm">{u.username}</span>
                {u.username === currentUser?.username && (
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">you</span>
                )}
                {u.is_active === 0 && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">disabled</span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {u.last_login ? `Last login: ${new Date(u.last_login).toLocaleDateString()}` : 'Never logged in'}
              </span>
            </div>
          ))}
        </div>
      </section>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}
    </div>
  );
}
