/**
 * Base HTTP client for the ForestGuard Python (FastAPI) backend.
 *
 * The sandbox gateway forwards any request carrying `?XTransformPort=3010`
 * to the mini-service listening on localhost:3010 — relative paths only.
 */

export const ML_PORT = 3010;

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

async function handle<T>(res: Response): Promise<T> {
  let body: { success?: boolean; data?: T; error?: string; message?: string } = {};
  try {
    body = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (!res.ok || body.success === false) {
    throw new ApiError(body.error || `Request failed (${res.status})`, res.status);
  }
  return body.data as T;
}

export async function apiGet<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const res = await fetch(buildUrl(path, params), { cache: "no-store" });
  return handle<T>(res);
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const res = await fetch(buildUrl(path, params), {
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
  const res = await fetch(buildUrl(path), { method: "POST", body: form });
  return handle<T>(res);
}
