import { useCallback, useEffect, useState } from 'react';
import { Loader2, KeyRound, UserPlus, ShieldAlert, Pencil, Trash2, X, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../../../auth/context/AuthContext';
import { useAdminScope } from '../../../../contexts/AdminScopeContext';
import { api } from '../../../../utils/api';
import SettingsToggle from '../SettingsToggle';

type UserRow = {
  id: number;
  username: string;
  is_active: number;
  is_admin: number;
  created_at: string;
  last_login: string | null;
};

export default function UsersTab() {
  const { t } = useTranslation('settings');
  const { user: currentUser } = useAuth();
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

  // Edit-user state
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editIsAdmin, setEditIsAdmin] = useState(false);
  const [editIsActive, setEditIsActive] = useState(true);
  const [editPassword, setEditPassword] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete-user state
  const [deletingUser, setDeletingUser] = useState<UserRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const showMessage = (message: string, isError = false) => {
    if (isError) {
      setError(message);
      setSuccess('');
    } else {
      setSuccess(message);
      setError('');
    }
  };

  const handleToggleScopeAll = useCallback(async () => {
    showMessage('');
    const next = await setScopeAll(!scopeAll);
    showMessage(next ? 'Superadmin view enabled' : 'Superadmin view disabled');
  }, [scopeAll, setScopeAll]);

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await api.auth.users.list();
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to load users' }));
        throw new Error(data.error || 'Failed to load users');
      }
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Failed to load users', true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      showMessage('');

      if (!newUsername.trim() || !newPassword) {
        showMessage('Username and password are required', true);
        return;
      }
      if (newUsername.trim().length < 3 || newPassword.length < 6) {
        showMessage('Username ≥ 3 chars, password ≥ 6 chars', true);
        return;
      }

      setIsCreating(true);
      try {
        const res = await api.auth.users.create(newUsername.trim(), newPassword);
        const data = await res.json().catch(() => ({ error: 'Failed to create user' }));
        if (!res.ok) {
          showMessage(data.error || 'Failed to create user', true);
        } else {
          showMessage(`User "${data.user.username}" created`);
          setNewUsername('');
          setNewPassword('');
          void fetchUsers();
        }
      } catch (err) {
        showMessage(err instanceof Error ? err.message : 'Network error', true);
      } finally {
        setIsCreating(false);
      }
    },
    [newUsername, newPassword, fetchUsers],
  );

  const handleChangePassword = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      showMessage('');

      if (!curPwd || !newPwd) {
        showMessage('All fields are required', true);
        return;
      }
      if (newPwd.length < 6) {
        showMessage('New password must be at least 6 characters', true);
        return;
      }
      if (newPwd !== confirmPwd) {
        showMessage('New passwords do not match', true);
        return;
      }

      setIsChangingPwd(true);
      try {
        const res = await fetch('/api/auth/password', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('auth-token')}` },
          body: JSON.stringify({ currentPassword: curPwd, newPassword: newPwd }),
        });
        const data = await res.json().catch(() => ({ error: 'Failed to change password' }));
        if (!res.ok) {
          showMessage(data.error || 'Failed to change password', true);
        } else {
          showMessage('Password changed successfully');
          setCurPwd('');
          setNewPwd('');
          setConfirmPwd('');
        }
      } catch (err) {
        showMessage(err instanceof Error ? err.message : 'Network error', true);
      } finally {
        setIsChangingPwd(false);
      }
    },
    [curPwd, newPwd, confirmPwd],
  );

  const startEdit = (user: UserRow) => {
    setEditingUser(user);
    setEditUsername(user.username);
    setEditIsAdmin(user.is_admin === 1);
    setEditIsActive(user.is_active === 1);
    setEditPassword('');
    showMessage('');
  };

  const cancelEdit = () => {
    setEditingUser(null);
  };

  const handleSaveEdit = async (user: UserRow) => {
    showMessage('');
    if (!editUsername.trim() || editUsername.trim().length < 3) {
      showMessage('Username must be at least 3 characters', true);
      return;
    }
    if (editPassword && editPassword.length < 6) {
      showMessage('Password must be at least 6 characters', true);
      return;
    }

    setIsSavingEdit(true);
    try {
      const fields: Record<string, unknown> = {
        username: editUsername.trim(),
        isAdmin: editIsAdmin,
        isActive: editIsActive,
      };
      if (editPassword) {
        fields.password = editPassword;
      }
      const res = await api.auth.users.update(user.id, fields);
      const data = await res.json().catch(() => ({ error: 'Failed to update user' }));
      if (!res.ok) {
        showMessage(data.error || 'Failed to update user', true);
      } else {
        showMessage(`User "${data.user.username}" updated`);
        setEditingUser(null);
        void fetchUsers();
      }
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Network error', true);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const startDelete = (user: UserRow) => {
    setDeletingUser(user);
    showMessage('');
  };

  const cancelDelete = () => {
    setDeletingUser(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingUser) return;
    showMessage('');
    setIsDeleting(true);
    try {
      const res = await api.auth.users.delete(deletingUser.id);
      const data = await res.json().catch(() => ({ error: 'Failed to delete user' }));
      if (!res.ok) {
        showMessage(data.error || 'Failed to delete user', true);
      } else {
        showMessage(`User "${deletingUser.username}" deleted`);
        setDeletingUser(null);
        void fetchUsers();
      }
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Network error', true);
    } finally {
      setIsDeleting(false);
    }
  };

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
          {users.map((u) => {
            const isSelf = u.id === currentUser?.id;
            const isEditing = editingUser?.id === u.id;
            const isConfirmingDelete = deletingUser?.id === u.id;

            return (
              <div
                key={u.id}
                className="rounded-lg border border-border bg-background px-4 py-3"
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <div className="flex-1">
                        <label className="mb-1 block text-xs text-muted-foreground">Username</label>
                        <input
                          type="text"
                          value={editUsername}
                          onChange={(e) => setEditUsername(e.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="mb-1 block text-xs text-muted-foreground">
                          New Password <span className="text-muted-foreground/60">(leave blank to keep)</span>
                        </label>
                        <input
                          type="password"
                          value={editPassword}
                          onChange={(e) => setEditPassword(e.target.value)}
                          placeholder="••••••"
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editIsAdmin}
                          onChange={(e) => setEditIsAdmin(e.target.checked)}
                          disabled={isSelf}
                          className="h-4 w-4 rounded border-border"
                        />
                        Admin
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editIsActive}
                          onChange={(e) => setEditIsActive(e.target.checked)}
                          disabled={isSelf}
                          className="h-4 w-4 rounded border-border"
                        />
                        Active
                      </label>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={isSavingEdit}
                        className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent"
                      >
                        <X className="h-3.5 w-3.5" />
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSaveEdit(u)}
                        disabled={isSavingEdit}
                        className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-60"
                      >
                        {isSavingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{u.username}</span>
                        {isSelf && (
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">you</span>
                        )}
                        {u.is_admin === 1 && (
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">admin</span>
                        )}
                        {u.is_active === 0 && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">disabled</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {u.last_login ? `Last login: ${new Date(u.last_login).toLocaleDateString()}` : 'Never logged in'}
                      </span>
                    </div>

                    {isConfirmingDelete ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-destructive">Delete?</span>
                        <button
                          type="button"
                          onClick={cancelDelete}
                          disabled={isDeleting}
                          className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-accent"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleConfirmDelete()}
                          disabled={isDeleting}
                          className="flex items-center gap-1 rounded-lg bg-destructive px-2 py-1 text-xs text-destructive-foreground hover:opacity-90 disabled:opacity-60"
                        >
                          {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          Delete
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(u)}
                          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        {!isSelf && (
                          <button
                            type="button"
                            onClick={() => startDelete(u)}
                            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-destructive transition-colors hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}
    </div>
  );
}
