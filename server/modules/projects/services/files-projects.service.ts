import { execFile } from 'node:child_process';
import type { Dirent } from 'node:fs';
import { appendFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { projectsDb } from '@/modules/database/index.js';
import { AppError } from '@/shared/utils.js';

const execFileAsync = promisify(execFile);

export type FilesProjectView = {
  name: string;
  path: string;
  description: string;
  aliases: string[];
  registered: boolean;
  lastModified: string;
};

export type CreateFilesProjectResult = {
  name: string;
  path: string;
  handoffPath: string;
  launchwordsUpdated: boolean;
  taskmasterInit: 'ok' | 'skipped' | 'failed';
  taskmasterInitDetail?: string;
};

type LaunchwordsEntry = {
  aliases: string[];
  description: string;
};

const LAUNCHWORDS_CACHE_TTL_MS = 60_000;
const TASKMASTER_INIT_TIMEOUT_MS = 120_000;
const PROJECT_NAME_PATTERN = /^[⺀-䶿一-鿿豈-﫿A-Za-z0-9][⺀-䶿一-鿿豈-﫿A-Za-z0-9 _.-]{0,79}$/;

let launchwordsCache: { loadedAt: number; entries: Map<string, LaunchwordsEntry> } | null = null;

function getFilesProjectsRoot(): string {
  return path.join(os.homedir(), 'files', 'projects');
}

function getLaunchwordsPath(): string {
  return path.join(os.homedir(), '.claude', 'project-launchwords.md');
}

function projectSuffix(projectPath: string): string {
  const marker = `${path.sep}projects${path.sep}`;
  const index = projectPath.lastIndexOf(marker);
  return index === -1 ? '' : projectPath.slice(index + marker.length);
}

function splitAliases(raw: string): string[] {
  return raw
    .split(/[/,、，;；|]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Parses `~/.claude/project-launchwords.md` (Boss's project alias table) so the picker can show
 * descriptions and search over aliases. Missing/unreadable file is not an error — the list
 * simply falls back to bare directory names. Cached briefly to keep the list endpoint snappy.
 */
async function loadLaunchwords(): Promise<Map<string, LaunchwordsEntry>> {
  if (launchwordsCache && Date.now() - launchwordsCache.loadedAt < LAUNCHWORDS_CACHE_TTL_MS) {
    return launchwordsCache.entries;
  }

  const entries = new Map<string, LaunchwordsEntry>();
  try {
    const raw = await readFile(getLaunchwordsPath(), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      if (!line.startsWith('|')) {
        continue;
      }
      const cells = line.split('|').map((cell) => cell.trim());
      if (cells.length < 4) {
        continue;
      }
      const pathCell = cells[2];
      if (!pathCell || pathCell === '---' || pathCell.startsWith(':') || !pathCell.includes('/projects/')) {
        continue;
      }
      const suffix = projectSuffix(pathCell.replace(/\/+$/, ''));
      // Only top-level project directories map to picker rows.
      if (!suffix || suffix.includes('/')) {
        continue;
      }
      const aliases = splitAliases(cells[1] || '');
      const description = cells[3] || '';
      const existing = entries.get(suffix);
      if (existing) {
        existing.aliases = Array.from(new Set([...existing.aliases, ...aliases]));
        if (!existing.description && description) {
          existing.description = description;
        }
      } else {
        entries.set(suffix, { aliases, description });
      }
    }
  } catch {
    // fall through with empty enrichment
  }

  launchwordsCache = { loadedAt: Date.now(), entries };
  return entries;
}

export async function listFilesProjects(userId: number): Promise<FilesProjectView[]> {
  const root = getFilesProjectsRoot();

  let dirents: Dirent[];
  try {
    dirents = await readdir(root, { withFileTypes: true });
  } catch {
    throw new AppError('Files projects directory is not available', {
      code: 'FILES_PROJECTS_ROOT_MISSING',
      statusCode: 500,
      details: root,
    });
  }

  const launchwords = await loadLaunchwords();
  const projects: FilesProjectView[] = [];

  for (const dirent of dirents) {
    if (!dirent.isDirectory() || dirent.name.startsWith('.') || dirent.name === '_archive') {
      continue;
    }
    const projectPath = path.join(root, dirent.name);
    try {
      const directoryStats = await stat(projectPath);
      let registered = false;
      try {
        registered = (await projectsDb.getProjectPath(projectPath, userId)) !== null;
      } catch {
        registered = false;
      }
      const entry = launchwords.get(dirent.name);
      projects.push({
        name: dirent.name,
        path: projectPath,
        description: entry?.description ?? '',
        aliases: entry?.aliases ?? [],
        registered,
        lastModified: directoryStats.mtime.toISOString(),
      });
    } catch {
      // dangling entry that vanished mid-scan — skip it
    }
  }

  projects.sort((a, b) => b.lastModified.localeCompare(a.lastModified));
  return projects;
}

function buildHandoffMarkdown(name: string, description: string): string {
  const created = new Date().toISOString().slice(0, 10);
  return [
    `# Handoff — ${name}`,
    '',
    `> 创建: ${created}(via claude-ui 项目选择器)`,
    '> 用途: 换会话时秒回状态。新会话进项目**先读本文件**。',
    '',
    '## 项目描述',
    description.trim() || '(待补)',
    '',
    '## 当前任务',
    '- 建立项目说明(目标 / 范围 / 交付物),可由 AI 引导完成',
    '',
    '## 进度(干到哪了)',
    '- (空)',
    '',
    '## 下一步(接手后先做这个)',
    '1. 补全本文件与 .taskmaster/docs/prd.txt',
    '',
  ].join('\n');
}

async function runTaskMasterInit(cwd: string): Promise<{ outcome: 'ok' | 'skipped' | 'failed'; detail?: string }> {
  try {
    await execFileAsync('npx', ['-y', 'task-master', 'init', '-y'], {
      cwd,
      timeout: TASKMASTER_INIT_TIMEOUT_MS,
      windowsHide: true,
    });
    return { outcome: 'ok' };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT') {
      return { outcome: 'skipped', detail: 'npx not available in server PATH' };
    }
    return { outcome: 'failed', detail: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Appends the new project to `~/.claude/project-launchwords.md` in its own clearly-marked
 * section so the boss's alias tables stay "只增不删" and CC/克拉 can merge it manually.
 */
async function appendLaunchwordsRow(name: string, description: string): Promise<boolean> {
  try {
    const section = [
      '',
      '## 选择器新增(自动追加,待合并进上表)',
      '| 启动词 / 别名 | 项目路径 | 一句话描述 |',
      '|---|---|---|',
      `| ${name} | ~/files/projects/${name} | ${description || '(待补)'} |`,
      '',
    ].join('\n');
    await appendFile(getLaunchwordsPath(), section, 'utf8');
    launchwordsCache = null;
    return true;
  } catch {
    return false;
  }
}

export async function createFilesProject(input: { name: string; description?: string }): Promise<CreateFilesProjectResult> {
  const name = (input.name || '').trim();
  if (!name || !PROJECT_NAME_PATTERN.test(name)) {
    throw new AppError('Invalid project name', {
      code: 'INVALID_FILES_PROJECT_NAME',
      statusCode: 400,
      details: 'Use letters, numbers, spaces, dot, dash, underscore or CJK; max 80 chars.',
    });
  }

  const root = getFilesProjectsRoot();
  const projectPath = path.join(root, name);
  const description = (input.description ?? '').trim();

  let existingPathStat: Awaited<ReturnType<typeof stat>> | null = null;
  try {
    existingPathStat = await stat(projectPath);
  } catch {
    existingPathStat = null;
  }
  if (existingPathStat) {
    throw new AppError('Project directory already exists', {
      code: 'FILES_PROJECT_ALREADY_EXISTS',
      statusCode: 409,
      details: projectPath,
    });
  }

  await mkdir(projectPath, { recursive: true });

  const handoffPath = path.join(projectPath, 'HANDOFF.md');
  await writeFile(handoffPath, buildHandoffMarkdown(name, description), 'utf8');

  const taskmasterInit = await runTaskMasterInit(projectPath);
  const launchwordsUpdated = await appendLaunchwordsRow(name, description);

  return {
    name,
    path: projectPath,
    handoffPath,
    launchwordsUpdated,
    taskmasterInit: taskmasterInit.outcome,
    taskmasterInitDetail: taskmasterInit.detail,
  };
}
