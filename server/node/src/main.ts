import { buildApp } from "./app.ts";

const port = Number(process.env.SERVER_PORT ?? 8081);
const delayMs = Number(process.env.DEMO_DELAY_MS ?? 300);

const app = await buildApp({ delayMs });
await app.listen({ port, host: "0.0.0.0" });
console.log(`names API (Node, TypeScript) listening on :${port}`);
