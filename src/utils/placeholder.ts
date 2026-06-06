export function render(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, key: string) => {
    if (key in vars) return String(vars[key]);
    return match;
  });
}
