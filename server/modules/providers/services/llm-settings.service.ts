import { readFile } from 'node:fs/promises';

import { AppError } from '@/shared/utils.js';

/**
 * LLM settings bridge to the cc-llm dashboard (pm2 `cc-llm-dashboard`, 127.0.0.1:9081).
 *
 * 磊哥 requirement (2026-09-22): the new-session LLM picker must list the LLMs
 * configured in settings (cc-llm 供应商方案库) instead of the five native CLI
 * providers. This service reads the cc-llm config (providers + profiles, no
 * secrets — the config file is key-free by design) and the `.current_profile`
 * SSOT marker, and proxies switch requests to the panel's
 * `/api/switch-and-apply` (preflight → backup → atomic write → headroom
 * restart → end-to-end probe → auto-rollback). No API keys ever pass through
 * this service.
 */

export type LlmSettingsProfile = {
  id: string;
  name: string;
  description: string;
  model: string;
  provider: string;
  color?: string;
};

export type LlmSettingsView = {
  profiles: LlmSettingsProfile[];
  activeProfileId: string | null;
  source: 'cc-llm' | 'unavailable';
};

export type LlmProfileSwitchResult = {
  success: true;
  profileId: string;
  output?: string;
};

type CcLlmApiConfig = {
  providers?: { id?: string; name?: string; color?: string }[];
  profiles?: {
    id?: string;
    name?: string;
    description?: string;
    model?: string;
    provider?: string;
  }[];
};

const DEFAULT_CONFIG_PATH = '/home/admin/files/projects/cc-llm/config/api-config.json';
const DEFAULT_PROFILE_STATE_PATH = '/home/admin/.claude/projects/cc_llm/.current_profile';
const DEFAULT_PANEL_BASE_URL = 'http://127.0.0.1:9081';
const SWITCH_TIMEOUT_MS = 120_000;

const getConfigPath = (): string => process.env.CLOUDCLI_CCLLM_CONFIG || DEFAULT_CONFIG_PATH;
const getProfileStatePath = (): string =>
  process.env.CLOUDCLI_CCLLM_PROFILE_STATE || DEFAULT_PROFILE_STATE_PATH;
const getPanelBaseUrl = (): string =>
  (process.env.CLOUDCLI_CCLLM_PANEL_URL || DEFAULT_PANEL_BASE_URL).replace(/\/+$/, '');

const readActiveProfileId = async (): Promise<string | null> => {
  try {
    const raw = await readFile(getProfileStatePath(), 'utf8');
    const profileId = raw.trim();
    return profileId || null;
  } catch {
    return null;
  }
};

const buildLlmSettingsView = (config: CcLlmApiConfig, activeProfileId: string | null): LlmSettingsView => {
  const colorByProvider = new Map<string, string | undefined>();
  for (const provider of config.providers ?? []) {
    if (provider.id) {
      colorByProvider.set(provider.id, provider.color);
    }
  }

  const profiles: LlmSettingsProfile[] = [];
  for (const profile of config.profiles ?? []) {
    if (!profile.id || !profile.name) {
      continue;
    }
    profiles.push({
      id: profile.id,
      name: profile.name,
      description: profile.description ?? '',
      model: profile.model ?? '',
      provider: profile.provider ?? '',
      color: colorByProvider.get(profile.provider ?? ''),
    });
  }

  return {
    profiles,
    activeProfileId: profiles.some((profile) => profile.id === activeProfileId)
      ? activeProfileId
      : null,
    source: 'cc-llm',
  };
};

export const llmSettingsService = {
  async getLlmSettings(): Promise<LlmSettingsView> {
    let config: CcLlmApiConfig;
    try {
      config = JSON.parse(await readFile(getConfigPath(), 'utf8')) as CcLlmApiConfig;
    } catch {
      // No cc-llm config on this host (e.g. dev machine) — the picker falls
      // back to the native provider list.
      return { profiles: [], activeProfileId: null, source: 'unavailable' };
    }

    return buildLlmSettingsView(config, await readActiveProfileId());
  },

  async switchLlmProfile(profileId: string): Promise<LlmProfileSwitchResult> {
    const normalizedProfileId = profileId.trim();
    if (!normalizedProfileId) {
      throw new AppError('profileId is required.', {
        code: 'INVALID_LLM_PROFILE',
        statusCode: 400,
      });
    }

    const settings = await this.getLlmSettings();
    if (!settings.profiles.some((profile) => profile.id === normalizedProfileId)) {
      throw new AppError(`Unknown LLM profile "${normalizedProfileId}".`, {
        code: 'UNKNOWN_LLM_PROFILE',
        statusCode: 400,
        details: settings.profiles.map((profile) => profile.id),
      });
    }

    let response: Response;
    try {
      response = await fetch(`${getPanelBaseUrl()}/api/switch-and-apply`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profileId: normalizedProfileId }),
        signal: AbortSignal.timeout(SWITCH_TIMEOUT_MS),
      });
    } catch (error) {
      throw new AppError('cc-llm panel is not reachable.', {
        code: 'CC_LLM_PANEL_UNREACHABLE',
        statusCode: 502,
        details: error instanceof Error ? error.message : String(error),
      });
    }

    let payload: { success?: boolean; output?: string; stderr?: string; rolledBack?: boolean; error?: string };
    try {
      payload = (await response.json()) as typeof payload;
    } catch {
      throw new AppError('cc-llm panel returned an invalid response.', {
        code: 'CC_LLM_PANEL_BAD_RESPONSE',
        statusCode: 502,
        details: `HTTP ${response.status}`,
      });
    }

    if (!response.ok || !payload.success) {
      const detail = payload.error || payload.stderr || payload.output || `HTTP ${response.status}`;
      throw new AppError(payload.rolledBack
        ? `LLM switch failed and was rolled back: ${detail}`
        : `LLM switch failed: ${detail}`, {
        code: 'LLM_SWITCH_FAILED',
        statusCode: 502,
        details: detail.slice(0, 2000),
      });
    }

    return {
      success: true,
      profileId: normalizedProfileId,
      output: payload.output?.slice(-2000),
    };
  },
};
