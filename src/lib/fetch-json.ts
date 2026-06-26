const DEFAULT_TIMEOUT_MS = 12_000;

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchInit } = init ?? {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  if (fetchInit.signal) {
    fetchInit.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    const res = await fetch(input, { ...fetchInit, signal: controller.signal });
    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text };
      }
    }
    if (!res.ok) {
      const message =
        (data as { error?: string })?.error ??
        `Request failed (${res.status})`;
      throw new Error(message);
    }
    return data as T;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Request timed out. The server may be misconfigured.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
