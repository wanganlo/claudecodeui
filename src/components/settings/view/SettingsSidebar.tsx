import { Bell, Bot, GitBranch, Info, Key, ListChecks, LogOut, Mic, MonitorPlay, Palette, Puzzle, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../../../components/auth/context/AuthContext';
import { cn } from '../../../lib/utils';
import { PillBar, Pill } from '../../../shared/view/ui';
import type { SettingsMainTab } from '../types/types';

type SettingsSidebarProps = {
  activeTab: SettingsMainTab;
  onChange: (tab: SettingsMainTab) => void;
};

type NavItem = {
  id: SettingsMainTab;
  labelKey: string;
  icon: typeof Bot;
};

const NAV_ITEMS: NavItem[] = [
  { id: 'agents', labelKey: 'mainTabs.agents', icon: Bot },
  { id: 'appearance', labelKey: 'mainTabs.appearance', icon: Palette },
  { id: 'git', labelKey: 'mainTabs.git', icon: GitBranch },
  { id: 'api', labelKey: 'mainTabs.apiTokens', icon: Key },
  { id: 'voice', labelKey: 'mainTabs.voice', icon: Mic },
  { id: 'tasks', labelKey: 'mainTabs.tasks', icon: ListChecks },
  { id: 'browser', labelKey: 'mainTabs.browser', icon: MonitorPlay },
  { id: 'plugins', labelKey: 'mainTabs.plugins', icon: Puzzle },
  { id: 'notifications', labelKey: 'mainTabs.notifications', icon: Bell },
  { id: 'about', labelKey: 'mainTabs.about', icon: Info },
  { id: 'users', labelKey: 'mainTabs.users', icon: Users },
];

export default function SettingsSidebar({ activeTab, onChange }: SettingsSidebarProps) {
  const { t } = useTranslation('settings');
  const { logout, user } = useAuth();
  // User management and plugin install/uninstall are admin-only (backend
  // enforces the same gate via requireAdmin).
  const isAdmin = user?.is_admin === 1;
  const visibleItems = isAdmin
    ? NAV_ITEMS
    : NAV_ITEMS.filter((item) => item.id !== 'users' && item.id !== 'plugins');

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-56 flex-shrink-0 border-r border-border bg-muted/30 md:flex md:flex-col">
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onChange(item.id)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors duration-150',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground active:bg-accent/50',
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {t(item.labelKey)}
              </button>
            );
          })}
        </nav>

        {/* User + logout — pinned to the bottom of the sidebar */}
        <div className="border-t border-border p-3">
          <div className="mb-2 truncate px-3 text-xs text-muted-foreground">
            {user?.username ?? ''}
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-accent/50 hover:text-foreground active:bg-accent/50"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            {t('logout.button', { ns: 'auth' })}
          </button>
        </div>
      </aside>

      {/* Mobile horizontal nav — pill bar */}
      <div className="flex-shrink-0 border-b border-border px-3 py-2 md:hidden">
        <PillBar className="scrollbar-hide w-full overflow-x-auto">
          {visibleItems.map((item) => {
            const Icon = item.icon;

            return (
              <Pill
                key={item.id}
                isActive={activeTab === item.id}
                onClick={() => onChange(item.id)}
                className="flex-shrink-0"
              >
                <Icon className="h-3.5 w-3.5" />
                {t(item.labelKey)}
              </Pill>
            );
          })}
          <Pill isActive={false} onClick={logout} className="flex-shrink-0">
            <LogOut className="h-3.5 w-3.5" />
            {t('logout.button', { ns: 'auth' })}
          </Pill>
        </PillBar>
      </div>
    </>
  );
}
