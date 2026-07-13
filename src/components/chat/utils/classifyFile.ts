export type FileCategory =
  | 'image'
  | 'text'
  | 'pdf'
  | 'binary-executable'
  | 'binary-other';

const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'bmp',
  'ico',
  'avif',
  'tiff',
  'tif',
]);

const TEXT_EXTENSIONS = new Set([
  'md',
  'markdown',
  'txt',
  'log',
  'json',
  'yaml',
  'yml',
  'toml',
  'csv',
  'tsv',
  'js',
  'ts',
  'jsx',
  'tsx',
  'mjs',
  'cjs',
  'css',
  'scss',
  'less',
  'html',
  'htm',
  'sh',
  'bash',
  'zsh',
  'fish',
  'py',
  'rb',
  'go',
  'rs',
  'java',
  'c',
  'h',
  'cpp',
  'hpp',
  'cs',
  'php',
  'swift',
  'kt',
  'kts',
  'scala',
  'sql',
  'env',
  'conf',
  'config',
  'ini',
  'xml',
  'xsl',
  'xsd',
  'patch',
  'diff',
  'gitignore',
  'dockerfile',
  'dockerignore',
  'makefile',
  'cmake',
  'gradle',
  'properties',
  'vue',
  'svelte',
  'graphql',
  'gql',
  'prisma',
  'proto',
]);

const COMPILED_EXECUTABLE_EXTENSIONS = new Set([
  'exe',
  'dll',
  'so',
  'dylib',
  'bin',
  'msi',
  'dmg',
  'pkg',
  'deb',
  'rpm',
  'app',
  'out',
  'o',
  'obj',
  'a',
  'lib',
]);

function getExtension(file: File): string {
  const parts = file.name.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

export function getFileId(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

export function classifyFile(file: File): FileCategory {
  if (!file) {
    return 'binary-other';
  }

  // Trust MIME type first when it is explicit.
  const type = (file.type || '').toLowerCase();
  if (type.startsWith('image/')) {
    return 'image';
  }
  if (type === 'application/pdf') {
    return 'pdf';
  }
  if (type.startsWith('text/')) {
    return 'text';
  }

  const ext = getExtension(file);

  if (ext === 'pdf') {
    return 'pdf';
  }
  if (IMAGE_EXTENSIONS.has(ext)) {
    return 'image';
  }
  if (COMPILED_EXECUTABLE_EXTENSIONS.has(ext)) {
    return 'binary-executable';
  }
  if (TEXT_EXTENSIONS.has(ext)) {
    return 'text';
  }

  return 'binary-other';
}

export function isCompiledExecutable(file: File): boolean {
  return classifyFile(file) === 'binary-executable';
}
