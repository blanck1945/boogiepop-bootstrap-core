/** Versiones publicadas en npm de libs compartidas Boogiepop. */
export const BOOGIEPOP_NPM_DEPS = {
  'boogiepop-ui': '0.1.0',
  'boogiepop-auth-sdk': '0.1.0',
  '@boogiepop/auth-sdk': '0.1.0',
} as const;

export function normalizeBoogiepopNpmDeps(
  dependencies: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!dependencies) return dependencies;

  const out = { ...dependencies };
  for (const [name, version] of Object.entries(BOOGIEPOP_NPM_DEPS)) {
    if (out[name]?.startsWith('file:')) {
      out[name] = version;
    }
  }
  return out;
}
