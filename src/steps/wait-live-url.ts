const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_POLL_MS = 10_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForLiveUrl(
  url: string,
  opts?: { timeoutMs?: number; pollIntervalMs?: number },
): Promise<boolean> {
  const deadline = Date.now() + (opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const pollMs = opts?.pollIntervalMs ?? DEFAULT_POLL_MS;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: 'GET', redirect: 'follow' });
      if (res.ok) {
        await res.body?.cancel();
        return true;
      }
    } catch {
      // retry
    }
    await sleep(pollMs);
  }

  return false;
}
