import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";

import type {
  ProjectSession,
  LLMProvider,
  ProviderModelsDefinition,
} from "../../../../types/app";
import { authenticatedFetch } from "../../../../utils/api";
import SessionProviderLogo from "../../../llm-logo-provider/SessionProviderLogo";
import { NextTaskBanner } from "../../../task-master";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  Card,
} from "../../../../shared/view/ui";

const PROVIDER_META: { id: LLMProvider; name: string }[] = [
  { id: "claude", name: "Anthropic" },
  { id: "codex", name: "OpenAI" },
  { id: "gemini", name: "Google" },
  { id: "cursor", name: "Cursor" },
  { id: "opencode", name: "OpenCode" },
];

const MOD_KEY =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";

// LLM options configured in the cc-llm dashboard (settings-driven, 磊哥
// 2026-09-22: 新会话的 LLM 列表来自设置,不列原生 CLI).
type LlmProfileOption = {
  id: string;
  name: string;
  description: string;
  model: string;
  provider: string;
  color?: string;
};

type SelectedLlmProfile = { id: string; name: string; model: string };

const SELECTED_LLM_PROFILE_STORAGE_KEY = "selected-llm-profile";

function readStoredLlmProfile(): SelectedLlmProfile | null {
  try {
    const raw = localStorage.getItem(SELECTED_LLM_PROFILE_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as SelectedLlmProfile;
    return parsed && typeof parsed.id === "string" && typeof parsed.name === "string"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

type ProviderSelectionEmptyStateProps = {
  selectedSession: ProjectSession | null;
  currentSessionId: string | null;
  provider: LLMProvider;
  setProvider: (next: LLMProvider) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  claudeModel: string;
  setClaudeModel: (model: string) => void;
  cursorModel: string;
  setCursorModel: (model: string) => void;
  codexModel: string;
  setCodexModel: (model: string) => void;
  geminiModel: string;
  setGeminiModel: (model: string) => void;
  opencodeModel: string;
  setOpenCodeModel: (model: string) => void;
  providerModelCatalog: Partial<Record<LLMProvider, ProviderModelsDefinition>>;
  providerModelsLoading: boolean;
  tasksEnabled: boolean;
  isTaskMasterInstalled: boolean | null;
  onShowAllTasks?: (() => void) | null;
  setInput: React.Dispatch<React.SetStateAction<string>>;
};

type ProviderGroup = {
  id: LLMProvider;
  name: string;
  models: { value: string; label: string; description?: string }[];
};

function getModelConfig(
  p: LLMProvider,
  catalog: Partial<Record<LLMProvider, ProviderModelsDefinition>>,
): ProviderModelsDefinition {
  const entry = catalog[p];
  return entry ?? { OPTIONS: [], DEFAULT: "" };
}

function getCurrentModel(
  p: LLMProvider,
  c: string,
  cu: string,
  co: string,
  g: string,
  o: string,
) {
  if (p === "claude") return c;
  if (p === "codex") return co;
  if (p === "gemini") return g;
  if (p === "opencode") return o;
  return cu;
}

function getProviderDisplayName(p: LLMProvider) {
  if (p === "claude") return "Claude";
  if (p === "cursor") return "Cursor";
  if (p === "codex") return "Codex";
  if (p === "opencode") return "OpenCode";
  return "Gemini";
}

export default function ProviderSelectionEmptyState({
  selectedSession,
  currentSessionId,
  provider,
  setProvider,
  textareaRef,
  claudeModel,
  setClaudeModel,
  cursorModel,
  setCursorModel,
  codexModel,
  setCodexModel,
  geminiModel,
  setGeminiModel,
  opencodeModel,
  setOpenCodeModel,
  providerModelCatalog,
  providerModelsLoading,
  tasksEnabled,
  isTaskMasterInstalled,
  onShowAllTasks,
  setInput,
}: ProviderSelectionEmptyStateProps) {
  const { t } = useTranslation("chat");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [llmProfiles, setLlmProfiles] = useState<LlmProfileOption[] | null>(null);
  const [llmSettingsUnavailable, setLlmSettingsUnavailable] = useState(false);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [switchingProfileId, setSwitchingProfileId] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [showNativeProviders, setShowNativeProviders] = useState(false);
  const [selectedLlmProfile, setSelectedLlmProfile] = useState<SelectedLlmProfile | null>(
    readStoredLlmProfile,
  );

  useEffect(() => {
    let cancelled = false;
    authenticatedFetch("/api/providers/llm-settings")
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (cancelled) {
          return;
        }
        if (!response.ok || !body?.success || !body?.data) {
          setLlmSettingsUnavailable(true);
          setLlmProfiles([]);
          return;
        }
        setLlmProfiles(Array.isArray(body.data.profiles) ? body.data.profiles : []);
        setActiveProfileId(body.data.activeProfileId ?? null);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setLlmSettingsUnavailable(true);
        setLlmProfiles([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleProviderGroups = useMemo<ProviderGroup[]>(() => {
    return PROVIDER_META.map((p) => ({
      id: p.id,
      name: p.name,
      models: providerModelCatalog[p.id]?.OPTIONS ?? [],
    }));
  }, [providerModelCatalog]);

  const nextTaskPrompt = t("tasks.nextTaskPrompt", {
    defaultValue: "Start the next task",
  });

  const currentModel = getCurrentModel(
    provider,
    claudeModel,
    cursorModel,
    codexModel,
    geminiModel,
    opencodeModel,
  );

  const currentModelLabel = useMemo(() => {
    const config = getModelConfig(provider, providerModelCatalog);
    const found = config.OPTIONS.find(
      (o: { value: string; label: string }) => o.value === currentModel,
    );
    return found?.label || currentModel;
  }, [provider, currentModel, providerModelCatalog]);

  const setModelForProvider = useCallback(
    (providerId: LLMProvider, modelValue: string) => {
      if (providerId === "claude") {
        setClaudeModel(modelValue);
        localStorage.setItem("claude-model", modelValue);
      } else if (providerId === "codex") {
        setCodexModel(modelValue);
        localStorage.setItem("codex-model", modelValue);
      } else if (providerId === "gemini") {
        setGeminiModel(modelValue);
        localStorage.setItem("gemini-model", modelValue);
      } else if (providerId === "opencode") {
        setOpenCodeModel(modelValue);
        localStorage.setItem("opencode-model", modelValue);
      } else {
        setCursorModel(modelValue);
        localStorage.setItem("cursor-model", modelValue);
      }
    },
    [setClaudeModel, setCursorModel, setCodexModel, setGeminiModel, setOpenCodeModel],
  );

  const handleModelSelect = useCallback(
    (providerId: LLMProvider, modelValue: string) => {
      // Picking a native CLI supersedes any settings-profile selection.
      localStorage.removeItem(SELECTED_LLM_PROFILE_STORAGE_KEY);
      setSelectedLlmProfile(null);
      setProvider(providerId);
      localStorage.setItem("selected-provider", providerId);
      setModelForProvider(providerId, modelValue);
      setDialogOpen(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    },
    [setProvider, setModelForProvider, textareaRef],
  );

  const commitProfileSelection = useCallback(
    (profile: { id: string; name: string; model: string }) => {
      const next = { id: profile.id, name: profile.name, model: profile.model };
      setSelectedLlmProfile(next);
      localStorage.setItem(SELECTED_LLM_PROFILE_STORAGE_KEY, JSON.stringify(next));
      // Sessions ride the claude runtime; the supplier itself is decided by
      // cc-llm's settings env, so the SDK model alias stays "default".
      setProvider("claude");
      localStorage.setItem("selected-provider", "claude");
      setClaudeModel("default");
      localStorage.setItem("claude-model", "default");
      setSwitchError(null);
      setDialogOpen(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    },
    [setClaudeModel, setProvider, textareaRef],
  );

  const handleProfileSelect = useCallback(
    async (profile: LlmProfileOption) => {
      if (switchingProfileId) {
        return;
      }
      if (profile.id === activeProfileId) {
        commitProfileSelection(profile);
        return;
      }
      setSwitchError(null);
      setSwitchingProfileId(profile.id);
      try {
        const response = await authenticatedFetch("/api/providers/llm-settings/switch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profileId: profile.id }),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok || !body?.success) {
          const detail =
            body?.error?.message || body?.error || body?.message || `HTTP ${response.status}`;
          setSwitchError(String(detail));
          return;
        }
        setActiveProfileId(profile.id);
        commitProfileSelection(profile);
      } catch (error) {
        setSwitchError(error instanceof Error ? error.message : String(error));
      } finally {
        setSwitchingProfileId(null);
      }
    },
    [activeProfileId, commitProfileSelection, switchingProfileId],
  );

  if (!selectedSession && !currentSessionId) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div className="w-full max-w-[34.25rem]">
          <div className="mb-8 text-center">
            <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              {t("providerSelection.title")}
            </h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {t("providerSelection.description")}
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Card
                className="group mx-auto max-w-xs cursor-pointer border-border/60 transition-all duration-150 hover:border-border hover:shadow-md active:scale-[0.99]"
                role="button"
                tabIndex={0}
              >
                <div className="flex items-center gap-2 p-3">
                  {selectedLlmProfile ? (
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          llmProfiles?.find((p) => p.id === selectedLlmProfile.id)?.color ||
                          "#10b981",
                      }}
                    />
                  ) : (
                    <SessionProviderLogo
                      provider={provider}
                      className="h-5 w-5 shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold text-foreground">
                        {selectedLlmProfile?.name ?? getProviderDisplayName(provider)}
                      </span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="truncate text-xs text-foreground">
                        {selectedLlmProfile?.model || currentModelLabel}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {t("providerSelection.clickToChange", {
                        defaultValue: "Click to change model",
                      })}
                    </p>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-y-0.5" />
                </div>
              </Card>
            </DialogTrigger>

            <DialogContent className="max-w-md overflow-hidden p-0">
              <DialogTitle>Model Selector</DialogTitle>
              <div className="border-b border-border/60 bg-muted/20 px-4 py-3">
                <p className="text-sm font-semibold text-foreground">
                  {t("providerSelection.selectLlmTitle", {
                    defaultValue: "选择 LLM(来自设置)",
                  })}
                </p>
              </div>
              <Command>
                <CommandInput
                  placeholder={t("providerSelection.searchModels", {
                    defaultValue: "Search models...",
                  })}
                />
                <CommandList className="max-h-[350px]">
                  <CommandEmpty>
                    {t("providerSelection.noModelsFound", {
                      defaultValue: "No models found.",
                    })}
                  </CommandEmpty>

                  {llmProfiles === null ? (
                    <CommandGroup
                      className="[&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
                      heading={t("providerSelection.llmGroupHeading", {
                        defaultValue: "配置的 LLM",
                      })}
                    >
                      <CommandItem disabled className="ml-4 border-l border-border/40 pl-4 text-muted-foreground">
                        {t("providerSelection.loadingModels", { defaultValue: "Loading models…" })}
                      </CommandItem>
                    </CommandGroup>
                  ) : null}

                  {llmProfiles !== null && llmProfiles.length > 0 ? (
                    <CommandGroup
                      className="[&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
                      heading={t("providerSelection.llmGroupHeading", {
                        defaultValue: "配置的 LLM",
                      })}
                    >
                      {llmProfiles.map((llmProfile) => {
                        const isSelected = selectedLlmProfile?.id === llmProfile.id;
                        const isActive = activeProfileId === llmProfile.id;
                        const isSwitching = switchingProfileId === llmProfile.id;
                        return (
                          <CommandItem
                            key={`llm-${llmProfile.id}`}
                            value={`${llmProfile.name} ${llmProfile.model} ${llmProfile.description}`}
                            onSelect={() => {
                              void handleProfileSelect(llmProfile);
                            }}
                            className="ml-4 border-l border-border/40 pl-4"
                          >
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: llmProfile.color || "#64748b" }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate">{llmProfile.name}</span>
                                {llmProfile.model && (
                                  <span className="truncate text-xs text-muted-foreground">
                                    {llmProfile.model}
                                  </span>
                                )}
                              </div>
                              {isSwitching && (
                                <div className="truncate text-xs text-muted-foreground">
                                  {t("providerSelection.switching", {
                                    defaultValue: "切换中,约 10–90 秒…",
                                  })}
                                </div>
                              )}
                            </div>
                            {isSwitching ? (
                              <Loader2 className="ml-auto h-4 w-4 shrink-0 animate-spin text-primary" />
                            ) : null}
                            {isActive && !isSwitching ? (
                              <span className="ml-auto rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                {t("providerSelection.currentBadge", { defaultValue: "当前" })}
                              </span>
                            ) : null}
                            {isSelected && !isActive && !isSwitching ? (
                              <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />
                            ) : null}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  ) : null}

                  {llmSettingsUnavailable || (llmProfiles !== null && llmProfiles.length === 0) ? (
                    <div className="px-4 py-2 text-xs text-muted-foreground">
                      {t("providerSelection.settingsUnavailable", {
                        defaultValue: "未读到 cc-llm 设置,以下显示原生 CLI。",
                      })}
                    </div>
                  ) : null}

                  {llmProfiles !== null && llmProfiles.length > 0 ? (
                    <div className="border-t border-border/40 px-4 py-2 text-[11px] leading-relaxed text-muted-foreground/80">
                      {t("providerSelection.switchHint", {
                        defaultValue:
                          "选择不同的 LLM 会全局切换供应商(headroom),约 10–90 秒;CC 机器人与新会话同步生效。",
                      })}
                    </div>
                  ) : null}

                  {switchError ? (
                    <div className="px-4 py-2 text-xs text-destructive">{switchError}</div>
                  ) : null}

                  <CommandGroup>
                    <CommandItem
                      value="native providers toggle"
                      onSelect={() => setShowNativeProviders((v) => !v)}
                      className="text-muted-foreground"
                    >
                      {showNativeProviders ? (
                        <ChevronUp className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <ChevronDown className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                      )}
                      {t("providerSelection.nativeToggle", {
                        defaultValue: "原生 CLI(Anthropic / OpenAI / Google…)",
                      })}
                    </CommandItem>
                  </CommandGroup>

                  {showNativeProviders &&
                    visibleProviderGroups.map((group, idx) => (
                      <CommandGroup
                        key={group.id}
                        className={
                          idx > 0
                            ? "border-t border-border/40 [&_[cmdk-group-heading]]:mt-1 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
                            : "[&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
                        }
                        heading={
                          <span className="flex items-center gap-1.5">
                            <SessionProviderLogo provider={group.id} className="h-3.5 w-3.5 shrink-0" />
                            {group.name}
                          </span>
                        }
                      >
                        {group.models.length === 0 && providerModelsLoading ? (
                          <CommandItem disabled className="ml-4 border-l border-border/40 pl-4 text-muted-foreground">
                            {t("providerSelection.loadingModels", { defaultValue: "Loading models…" })}
                          </CommandItem>
                        ) : null}
                        {group.models.map((model) => {
                          const isSelected = provider === group.id && currentModel === model.value;
                          return (
                            <CommandItem
                              key={`${group.id}-${model.value}`}
                              value={`${group.name} ${model.label} ${model.description || ''}`}
                              onSelect={() => handleModelSelect(group.id, model.value)}
                              className="ml-4 border-l border-border/40 pl-4"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="truncate">{model.label}</div>
                                {model.description && (
                                  <div className="truncate text-xs text-muted-foreground">
                                    {model.description}
                                  </div>
                                )}
                              </div>
                              {isSelected && (
                                <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />
                              )}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    ))}
                </CommandList>
              </Command>
            </DialogContent>
          </Dialog>

          <p className="mt-4 text-center text-sm text-muted-foreground/70">
            {selectedLlmProfile
              ? t("providerSelection.readyPrompt.profile", {
                  name: selectedLlmProfile.name,
                  model: selectedLlmProfile.model,
                  defaultValue: "Ready with {{name}} · {{model}}. Start typing your message below.",
                })
              : (
                  {
                    claude: t("providerSelection.readyPrompt.claude", {
                      model: claudeModel,
                    }),
                    cursor: t("providerSelection.readyPrompt.cursor", {
                      model: cursorModel,
                    }),
                    codex: t("providerSelection.readyPrompt.codex", {
                      model: codexModel,
                    }),
                    gemini: t("providerSelection.readyPrompt.gemini", {
                      model: geminiModel,
                    }),
                    opencode: t("providerSelection.readyPrompt.opencode", {
                      model: opencodeModel,
                      defaultValue: "Ready with OpenCode {{model}}",
                    }),
                  }[provider]
                )}
          </p>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground/60">
            <Trans
              ns="chat"
              i18nKey="providerSelection.pressToSearch"
              values={{ shortcut: MOD_KEY === "⌘" ? "⌘K" : "Ctrl+K" }}
              components={{
                kbd: (
                  <kbd className="inline-flex items-center gap-0.5 rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px]" />
                ),
              }}
            />
          </p>

          {provider && tasksEnabled && isTaskMasterInstalled && (
            <div className="mt-5">
              <NextTaskBanner
                onStartTask={() => setInput(nextTaskPrompt)}
                onShowAllTasks={onShowAllTasks}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (selectedSession) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-[34.25rem] px-6 text-center">
          <p className="mb-1.5 text-lg font-semibold text-foreground">
            {t("session.continue.title")}
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("session.continue.description")}
          </p>

          {tasksEnabled && isTaskMasterInstalled && (
            <div className="mt-5">
              <NextTaskBanner
                onStartTask={() => setInput(nextTaskPrompt)}
                onShowAllTasks={onShowAllTasks}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
