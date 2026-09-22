import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FolderPlus, Link2Off, Loader2, Plus, Search, X } from 'lucide-react';

import { authenticatedFetch } from '../../utils/api';
import { useWebSocket } from '../../contexts/WebSocketContext';
import type { LLMProvider } from '../../types/app';
import { DEFAULT_EFFORT_VALUE } from '../chat/constants/providerEffort';
import { Button, Input } from '../../shared/view/ui';
import { cn } from '../../lib/utils';

type FilesProject = {
  name: string;
  path: string;
  description: string;
  aliases: string[];
  registered: boolean;
  lastModified: string;
};

type FilesProjectPickerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onOpenAdvancedWizard: () => void;
};

const FALLBACK_PROVIDER_MODEL: Record<LLMProvider, string> = {
  claude: 'default',
  cursor: 'gpt-5.3-codex',
  codex: 'gpt-5.4',
  gemini: 'gemini-3.1-pro-preview',
  opencode: 'anthropic/claude-sonnet-4-5',
};

const PROVIDERS: LLMProvider[] = ['claude', 'cursor', 'codex', 'gemini', 'opencode'];

function readStoredProvider(): LLMProvider {
  try {
    const stored = localStorage.getItem('selected-provider') as LLMProvider | null;
    if (stored && PROVIDERS.includes(stored)) {
      return stored;
    }
  } catch {
    // ignore
  }
  return 'claude';
}

function readStoredModel(provider: LLMProvider): string {
  try {
    const stored = localStorage.getItem(`${provider}-model`);
    if (stored) {
      return stored;
    }
  } catch {
    // ignore
  }
  return FALLBACK_PROVIDER_MODEL[provider] || 'default';
}

function readStoredEffort(provider: LLMProvider): string {
  try {
    const stored = localStorage.getItem(`${provider}-effort`);
    if (stored) {
      return stored;
    }
  } catch {
    // ignore
  }
  return DEFAULT_EFFORT_VALUE;
}

function readToolsSettings(provider: LLMProvider) {
  try {
    const raw = localStorage.getItem(
      provider === 'cursor'
        ? 'cursor-tools-settings'
        : provider === 'codex'
          ? 'codex-settings'
          : provider === 'gemini'
            ? 'gemini-settings'
            : provider === 'opencode'
              ? 'opencode-settings'
              : 'claude-settings',
    );
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return { allowedTools: [], disallowedTools: [], skipPermissions: false };
}

function truncateSummary(input: string): string {
  const normalized = input.replace(/\s+/g, ' ').trim();
  return normalized.length > 80 ? `${normalized.slice(0, 77)}...` : normalized;
}

export default function FilesProjectPickerModal({ isOpen, onClose, onOpenAdvancedWizard }: FilesProjectPickerModalProps) {
  const { t } = useTranslation('sidebar');
  const navigate = useNavigate();
  const { sendMessage } = useWebSocket();

  const [view, setView] = useState<'list' | 'create'>('list');
  const [projects, setProjects] = useState<FilesProject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [startingPath, setStartingPath] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const provider = readStoredProvider();
  const model = readStoredModel(provider);
  const effort = readStoredEffort(provider);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await authenticatedFetch('/api/projects/files-list');
      if (!response.ok) {
        throw new Error('Failed to load projects');
      }
      const payload = (await response.json()) as { projects?: FilesProject[] };
      setProjects(Array.isArray(payload.projects) ? payload.projects : []);
    } catch {
      setLoadError(t('filesPicker.loadFailed', { defaultValue: 'Failed to load project list' }));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setView('list');
    setQuery('');
    setNewName('');
    setNewDescription('');
    setCreateError(null);
    setStartingPath(null);
    void fetchProjects();
    window.setTimeout(() => searchInputRef.current?.focus(), 50);
  }, [isOpen, fetchProjects]);

  useEffect(() => {
    if (view === 'create') {
      window.setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [view]);

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return projects;
    }
    return projects.filter(
      (project) =>
        project.name.toLowerCase().includes(normalizedQuery) ||
        (project.description || '').toLowerCase().includes(normalizedQuery) ||
        project.aliases.some((alias) => alias.toLowerCase().includes(normalizedQuery)),
    );
  }, [projects, query]);

  const startSession = useCallback(
    async (projectPath: string, customName: string, firstMessage?: string) => {
      setStartingPath(projectPath);
      try {
        // Ensure the path is registered as a CloudCLI project (409 = already active, fine).
        await authenticatedFetch('/api/projects/create-project', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: projectPath, customName }),
        }).catch(() => null);

        const sessionResponse = await authenticatedFetch('/api/providers/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider, projectPath }),
        });
        if (!sessionResponse.ok) {
          throw new Error('Failed to create session');
        }
        const sessionPayload = (await sessionResponse.json()) as { data?: { sessionId?: string } };
        const sessionId = sessionPayload?.data?.sessionId;
        if (!sessionId) {
          throw new Error('No session id returned');
        }

        if (firstMessage) {
          const toolsSettings = readToolsSettings(provider);
          sendMessage({
            type: 'chat.send',
            sessionId,
            content: firstMessage,
            options: {
              model,
              effort,
              permissionMode: 'default',
              toolsSettings,
              skipPermissions: toolsSettings?.skipPermissions || false,
              sessionSummary: truncateSummary(firstMessage),
              images: [],
              attachments: [],
            },
          });
        }

        navigate(`/session/${sessionId}`);
        onClose();
      } catch {
        setStartingPath(null);
        setLoadError(t('filesPicker.startFailed', { defaultValue: 'Failed to start a session in this project' }));
      }
    },
    [provider, model, effort, sendMessage, navigate, onClose, t],
  );

  const handleCreateProject = useCallback(async () => {
    const trimmedName = newName.trim();
    if (!trimmedName || isCreating) {
      return;
    }
    setIsCreating(true);
    setCreateError(null);
    try {
      const response = await authenticatedFetch('/api/projects/create-files-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, description: newDescription.trim() }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: 'Failed to create project' }));
        throw new Error(typeof body.error === 'string' ? body.error : 'Failed to create project');
      }
      const payload = (await response.json()) as { project?: { path?: string; name?: string } };
      const projectPath = payload.project?.path;
      if (!projectPath) {
        throw new Error('No project path returned');
      }
      await startSession(projectPath, payload.project?.name || trimmedName, t('filesPicker.guidingMessage', { defaultValue: '' }));
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : String(error));
      setIsCreating(false);
    }
  }, [newName, newDescription, isCreating, startSession, t]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-16 backdrop-blur-sm">
      <div className="flex h-[70vh] max-h-[600px] w-full max-w-2xl flex-col rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
        {view === 'list' ? (
          <>
            <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('filesPicker.title', { defaultValue: 'Pick a project' })}
              </h2>
              <button
                onClick={onClose}
                className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                title="Close"
              >
                <X className="h-5 w-5 rotate-45" />
              </button>
            </div>

            <div className="border-b border-gray-200 p-3 dark:border-gray-700">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  ref={searchInputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('filesPicker.searchPlaceholder', {
                    defaultValue: 'Search by name, alias or description...',
                  })}
                  className="w-full pl-9"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {isLoading && (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500 dark:text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('filesPicker.loading', { defaultValue: 'Loading projects...' })}
                </div>
              )}
              {!isLoading && loadError && (
                <div className="py-10 text-center text-sm text-destructive">{loadError}</div>
              )}
              {!isLoading && !loadError && filteredProjects.length === 0 && (
                <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                  {t('filesPicker.empty', { defaultValue: 'No projects match your search' })}
                </div>
              )}
              {!isLoading &&
                filteredProjects.map((project) => {
                  const isStarting = startingPath === project.path;
                  return (
                    <button
                      key={project.path}
                      onClick={() => void startSession(project.path, project.name)}
                      disabled={startingPath !== null}
                      className={cn(
                        'group w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-gray-100 disabled:cursor-wait disabled:opacity-60 dark:hover:bg-gray-800',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                          {project.name}
                        </span>
                        <span className="flex flex-shrink-0 items-center gap-2">
                          {!project.registered && (
                            <span
                              className="flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                              title={t('filesPicker.unregisteredHint', { defaultValue: 'Will be linked on first use' })}
                            >
                              <Link2Off className="h-3 w-3" />
                              {t('filesPicker.unregistered', { defaultValue: 'Not linked' })}
                            </span>
                          )}
                          {isStarting && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                        </span>
                      </div>
                      {project.description && (
                        <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{project.description}</p>
                      )}
                      {project.aliases.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {project.aliases.slice(0, 4).map((alias) => (
                            <span
                              key={alias}
                              className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-600 dark:bg-blue-900/40 dark:text-blue-300"
                            >
                              {alias}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
            </div>

            <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setView('create')}
                disabled={startingPath !== null}
                className="gap-1.5"
              >
                <FolderPlus className="h-4 w-4" />
                {t('filesPicker.newProject', { defaultValue: 'New project' })}
              </Button>
              <button
                onClick={onOpenAdvancedWizard}
                className="text-xs text-gray-500 underline-offset-2 hover:underline dark:text-gray-400"
              >
                {t('filesPicker.advancedPath', { defaultValue: 'Custom path...' })}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setView('list')}
                  className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                  title={t('filesPicker.backToList', { defaultValue: 'Back to list' })}
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t('filesPicker.createTitle', { defaultValue: 'Create a new project' })}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                title="Close"
              >
                <X className="h-5 w-5 rotate-45" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('filesPicker.nameLabel', { defaultValue: 'Project name' })}
                </label>
                <div className="relative">
                  <Plus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 rotate-45 text-gray-400" />
                  <Input
                    ref={nameInputRef}
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder={t('filesPicker.namePlaceholder', { defaultValue: 'e.g. 仟源客户管理 or my-new-app' })}
                    className="pl-9"
                    disabled={isCreating}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && newName.trim()) {
                        void handleCreateProject();
                      }
                    }}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  {t('filesPicker.nameHint', { defaultValue: 'Folder under ~/files/projects/' })}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('filesPicker.descriptionLabel', { defaultValue: 'Description' })}
                </label>
                <textarea
                  value={newDescription}
                  onChange={(event) => setNewDescription(event.target.value)}
                  rows={3}
                  disabled={isCreating}
                  placeholder={t('filesPicker.descriptionPlaceholder', {
                    defaultValue: 'What is this project for? (goes into HANDOFF.md)',
                  })}
                  className="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-700 dark:text-gray-100"
                />
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                {t('filesPicker.createHint', {
                  defaultValue:
                    'Creates the folder, initializes TaskMaster, writes a HANDOFF.md skeleton, then starts a guided session to complete the project description.',
                })}
              </div>

              {createError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {createError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
              <Button
                onClick={() => void handleCreateProject()}
                disabled={!newName.trim() || isCreating}
                className="gap-1.5"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('filesPicker.creating', { defaultValue: 'Creating...' })}
                  </>
                ) : (
                  t('filesPicker.createButton', { defaultValue: 'Create & start guided session' })
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
