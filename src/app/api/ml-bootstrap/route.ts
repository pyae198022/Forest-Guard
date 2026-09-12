import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { existsSync } from "fs";

/**
 * ML backend bootstrap — keeps the FastAPI service on :3010 alive.
 *
 * The backend is spawned as a child of the Next.js dev-server process tree
 * (the sandbox's sanctioned long-lived tree), so it survives across sessions.
 * Safe to call repeatedly: it is a no-op while the backend is healthy.
 */
async function backendHealthy(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await fetch("http://127.0.0.1:3010/health", {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET() {
  // Sandbox/dev-only helper: it spawns a local uvicorn on :3010.  It must
  // never run in production — on Vercel the backend is a separate Render
  // service reached through the /api/* rewrite.  Guard with an explicit env
  // flag so production returns a clear, inert response.
  if (process.env.NODE_ENV !== "development" &&
      process.env.ENABLE_ML_BOOTSTRAP !== "true") {
    return NextResponse.json(
      {
        status: "disabled",
        reason: "ML bootstrap is only available in the development/sandbox environment",
      },
      { status: 200 },
    );
  }

  if (await backendHealthy()) {
    return NextResponse.json({ status: "healthy", spawned: false });
  }

  const cwd = process.cwd();
  if (!existsSync(`${cwd}/server/app.py`)) {
    return NextResponse.json(
      { status: "error", reason: "server/app.py not found" },
      { status: 500 },
    );
  }

  const log = `${cwd}/logs/ml-server.log`;
  const child = spawn(
    "bash",
    [
      "-c",
      `mkdir -p ${cwd}/logs && cd ${cwd} && nohup python3 -m uvicorn server.app:app --host 0.0.0.0 --port 3010 >> ${log} 2>&1 & echo $! > ${cwd}/logs/ml-server.pid`,
    ],
    { detached: true, stdio: "ignore", env: process.env },
  );
  child.unref();

  // give the backend a moment to bind
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    if (await backendHealthy()) {
      return NextResponse.json({ status: "spawned-healthy", spawned: true });
    }
  }
  return NextResponse.json(
    { status: "spawned-starting", spawned: true },
    { status: 202 },
  );
}
