import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { authenticatedFetch } from '../../../../utils/api';
import type { LLMProvider } from '../../../../types/app';
import { DEFAULT_EFFORT_VALUE } from '../../../chat/constants/providerEffort';

const FALLBACK_PROVIDER_MODEL: Record<LLMProvider, string> = {
  claude: 'default',
  cursor: 'gpt-5.3-codex',
  codex: 'gpt-5.4',
  gemini: 'gemini-3.1-pro-preview',
  opencode: 'anthropic/claude-sonnet-4-5',
};

const PROVIDERS: LLMProvider[] = ['claude', 'cursor', 'codex', 'gemini', 'opencode'];

type LandingChatViewProps = {
  isMobile?: boolean;
  sendMessage: (message: unknown) => void;
};

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
  return FALLBACK_PROVIDER_MODEL[provider];
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

export default function LandingChatView({ isMobile, sendMessage }: LandingChatViewProps) {
  const { t } = useTranslation(['chat', 'common']);
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const provider = readStoredProvider();
  const model = readStoredModel(provider);
  const effort = readStoredEffort(provider);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) {
      return;
    }
    el.style.height = 'auto';
    const nextHeight = Math.max(22, el.scrollHeight);
    el.style.height = `${nextHeight}px`;
  }, [input]);

  const handleSubmit = useCallback(async () => {
    const content = input.trim();
    if (!content || isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const projectResponse = await authenticatedFetch('/api/projects/ensure-default-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!projectResponse.ok) {
        const body = await projectResponse.json().catch(() => ({ error: 'Failed to create default project' }));
        throw new Error(typeof body.error === 'string' ? body.error : 'Failed to create default project');
      }
      const projectPayload = (await projectResponse.json()) as { success?: boolean; project?: { projectId?: string; fullPath?: string; path?: string } };
      const project = projectPayload.project;
      const projectPath = project?.fullPath || project?.path;
      if (!projectPath) {
        throw new Error('Default project did not return a path');
      }

      const sessionResponse = await authenticatedFetch('/api/providers/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, projectPath }),
      });
      if (!sessionResponse.ok) {
        const body = await sessionResponse.json().catch(() => ({ error: 'Failed to create session' }));
        throw new Error(typeof body.error === 'string' ? body.error : 'Failed to create session');
      }
      const sessionPayload = (await sessionResponse.json()) as { data?: { sessionId?: string } };
      const sessionId = sessionPayload?.data?.sessionId;
      if (!sessionId) {
        throw new Error('No session id returned');
      }

      const toolsSettings = readToolsSettings(provider);

      sendMessage({
        type: 'chat.send',
        sessionId,
        content,
        options: {
          model,
          effort,
          permissionMode: 'default',
          toolsSettings,
          skipPermissions: toolsSettings?.skipPermissions || false,
          sessionSummary: truncateSummary(content),
          images: [],
          attachments: [],
        },
      });

      navigate(`/session/${sessionId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setIsLoading(false);
    }
  }, [input, isLoading, provider, model, effort, sendMessage, navigate]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }
    event.preventDefault();
    void handleSubmit();
  };

  const providerLabel =
    provider === 'cursor'
      ? t('messageTypes.cursor')
      : provider === 'codex'
        ? t('messageTypes.codex')
        : provider === 'gemini'
          ? t('messageTypes.gemini')
          : provider === 'opencode'
            ? t('messageTypes.opencode', { defaultValue: 'OpenCode' })
            : t('messageTypes.claude');

  return (
    <div className="flex h-full flex-col items-center justify-center px-4">
      <div className="w-full max-w-2xl">
        <h1 className="mb-2 text-center text-2xl font-semibold text-foreground">
          {t('mainContent.welcome', { defaultValue: 'What can I help you with?' })}
        </h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          {t('mainContent.landingSubtitle', {
            defaultValue: `Start a conversation with {{provider}}. Your first chat will create your personal workspace.`,
            provider: providerLabel,
          })}
        </p>

        <div className="relative rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isLoading}
            placeholder={t('input.placeholder', {
              defaultValue: 'Message {{provider}}...',
              provider: providerLabel,
            })}
            className="max-h-48 w-full resize-none bg-transparent px-2 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-between px-1">
            <span className="text-xs text-muted-foreground">
              {t('input.shiftEnterForNewLine', { defaultValue: 'Shift + Enter for new line' })}
            </span>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!input.trim() || isLoading}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? t('common:actions.sending', { defaultValue: 'Sending...' }) : t('common:actions.send', { defaultValue: 'Send' })}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
