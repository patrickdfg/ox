// Retry only temporary provider failures; never log prompts, tokens, or keys.
export async function fetchWithRetry(url, options, { fetcher = fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  for (let attempt = 0; ; attempt++) {
    const response = await fetcher(url, { ...options, signal: AbortSignal.timeout(60000) });
    if (![500, 502, 503, 504].includes(response.status) || attempt >= 2) return response;
    await response.body?.cancel();
    await sleep(1000 * 2 ** attempt);
  }
}
