/**
 * User preferences repository.
 *
 * Stores per-user application preferences (e.g. superadmin_view) as JSON.
 * Modeled on notification-preferences.db.ts.
 */

import { getConnection } from '@/modules/database/connection.js';

type UserPreferences = {
  /** When true, an admin user can read/write all users' projects & sessions (no new-session creation). */
  superadmin_view: boolean;
  [key: string]: boolean;
};

const DEFAULT_USER_PREFERENCES: UserPreferences = {
  superadmin_view: false,
};

function normalizeUserPreferences(value: unknown): UserPreferences {
  const source = value && typeof value === 'object' ? (value as Record<string, any>) : {};
  const extras = Object.fromEntries(
    Object.entries(source).filter(([, v]) => typeof v === 'boolean')
  ) as Record<string, boolean>;

  return {
    ...extras,
    superadmin_view: source.superadmin_view === true,
  };
}

export const userPreferencesDb = {
  /** Returns the normalized preferences for a user, creating defaults on first read. */
  getPreferences(userId: number): UserPreferences {
    const db = getConnection();
    const row = db
      .prepare('SELECT preferences_json FROM user_preferences WHERE user_id = ?')
      .get(userId) as { preferences_json: string } | undefined;

    if (!row) {
      const defaults = normalizeUserPreferences(DEFAULT_USER_PREFERENCES);
      db.prepare(
        'INSERT INTO user_preferences (user_id, preferences_json, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
      ).run(userId, JSON.stringify(defaults));
      return defaults;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(row.preferences_json);
    } catch {
      parsed = DEFAULT_USER_PREFERENCES;
    }
    return normalizeUserPreferences(parsed);
  },

  /** Sets a single preference key and returns the full normalized preferences. */
  setPreference(userId: number, key: string, value: unknown): UserPreferences {
    const current = userPreferencesDb.getPreferences(userId);
    const next = normalizeUserPreferences({ ...current, [key]: value });
    const db = getConnection();

    db.prepare(
      `INSERT INTO user_preferences (user_id, preferences_json, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id) DO UPDATE SET
         preferences_json = excluded.preferences_json,
         updated_at = CURRENT_TIMESTAMP`
    ).run(userId, JSON.stringify(next));

    return next;
  },
};
