/** URL HTTPS con token embebido (solo uso interno bootstrap; no loguear). */
export function buildAuthedHttpsUrl(httpsUrl: string, token: string): string {
  if (!httpsUrl.startsWith('https://')) {
    throw new Error('Solo URLs HTTPS soportadas para autenticación');
  }
  return httpsUrl.replace('https://', `https://x-access-token:${token}@`);
}
