/**
 * Base HTTP client for the ForestGuard Python (FastAPI) backend.
 *
 * The sandbox gateway forwards any request carrying `?XTransformPort=3010`
 * to the mini-service listening on localhost:3010 — relative paths only.
 * In production the same `/api/*` paths are rewritten by Next.js to the
 * Render-hosted backend via the BACKEND_URL environment variable.
 */

export const ML_PORT = 3010;

const DEFAULT_TIMEOUT_MS = 120_000;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>) {
  const qs = new URLSearchParams();
  qs.set("XTransformPort", String(ML_PORT));
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    }
  }
  return `${path}?${qs.toString()}`;
}

const STATUS_HINTS: Record<number, string> = {
  400: "The request was invalid",
  404: "Resource not found (endpoint, dataset or model file missing)",
  408: "The request timed out",
  422: "The request payload was rejected",
  500: "The backend hit an internal error",
  502: "The backend is temporarily unavailable or exceeded the proxy timeout",
  503: "A required model/service is not ready yet",
  504: "The backend did not respond in time",
};

function describeError(status: number, bodyError?: string): string {
  const hint = STATUS_HINTS[status] ?? `Request failed (${status})`;
  if (bodyError) return `${hint}: ${bodyError}`;
  return hint;
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      throw new ApiError(
        `Request timed out after ${Math.round(timeoutMs / 1000)}s — the backend is too slow or down`,
        408,
      );
    }
    // fetch throws a TypeError for network-level failures
    throw new ApiError(
      "Backend unavailable — could not reach the API server (is the backend deployed and BACKEND_URL set?)",
      0,
    );
  } finally {
    clearTimeout(timer);
  }
}

async function handle<T>(res: Response): Promise<T> {
  let body: { success?: boolean; data?: T; error?: string; message?: string } = {};
  try {
    body = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (!res.ok || body.success === false) {
    throw new ApiError(
      describeError(res.status, body.error ?? body.message),
      res.status,
    );
  }
  return body.data as T;
}

export async function apiGet<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const res = await fetchWithTimeout(buildUrl(path, params), { cache: "no-store" });
  return handle<T>(res);
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const res = await fetchWithTimeout(buildUrl(path, params), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
    cache: "no-store",
  });
  return handle<T>(res);
}

export async function apiUpload<T>(path: string, file: File): Promise<T> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetchWithTimeout(buildUrl(path), { method: "POST", body: form });
  return handle<T>(res);
}