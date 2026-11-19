// Vercel function for jsctrls.com: the demo names API. The logic and its tests
// live in apps/hello/server/names.ts; this file only maps HTTP methods to it.
// vercel.json rewrites /api/names/:id here as ?id=:id.
import { createNamesApi } from "../apps/hello/server/names.js";

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env;
const api = createNamesApi({ delayMs: Number(env?.DEMO_DELAY_MS ?? 300) });

export function GET(request: Request): Promise<Response> {
  return api.handle(request);
}

export function POST(request: Request): Promise<Response> {
  return api.handle(request);
}

export function PATCH(request: Request): Promise<Response> {
  return api.handle(request);
}

export function DELETE(request: Request): Promise<Response> {
  return api.handle(request);
}
