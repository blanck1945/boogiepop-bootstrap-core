export function slugify(str: string): string {
  return str
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/gi, '')
    .toLowerCase()
    .replace(/^-+|-+$/g, '');
}

export function toSnakeCase(str: string): string {
  return str.replace(/-/g, '_');
}

export function toPascalCase(str: string): string {
  return str
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

export function toAlbAbbrev(str: string): string {
  const parts = str.split('-');
  if (parts.length === 1) return str.slice(0, 4).toLowerCase();
  return parts.map((p) => p.slice(0, 2)).join('').slice(0, 4).toLowerCase();
}

export function buildAppName(rawName: string): string {
  return slugify(rawName);
}

export function buildRepoName(appName: string): string {
  return appName.startsWith('boogiepop-') ? appName : `boogiepop-${appName}`;
}

export function buildTitle(appName: string): string {
  return appName
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
