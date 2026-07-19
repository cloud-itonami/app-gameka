/**
 * gameka XRPC adapter — CF Worker.
 *
 * Wires the kotoba reference impl (13 TS functions) into a deployable
 * CF Worker that exposes each function as an XRPC endpoint at
 * https://gameka.etzhayyim.com/xrpc/com.etzhayyim.gameka.<cmd>
 *
 * Per ADR-2605210000 execution-layer demonstration. Instantiates the
 * Etzhayyim SDK from env bindings, calls the kotoba function with parsed input,
 * and maps status codes to HTTP responses.
 */

import {
  createAuthedEtzhayyim,
  extractBearerToken,
  type Etzhayyim,
} from "@etzhayyim/sdk-auth";
import * as gamekaRwFree from "@etzhayyim/gameka-kotoba";

interface Env {
  ACTOR_DID: string;
  PDS_URL: string;
  L2_RPC_URL: string;
  PDS_ACCESS_JWT?: string;
  PDS_REFRESH_JWT?: string;
}

type Handler = (e: Etzhayyim, input: unknown) => Promise<unknown>;

const NSID_BASE = "com.etzhayyim.gameka";

interface RouteConfig {
  method: "POST" | "GET";
  handler: Handler;
}

const routes: Record<string, RouteConfig> = {
  [`${NSID_BASE}.getGameSpec`]: { method: "GET", handler: (e, input) => gamekaRwFree.getGameSpec(e, input as any) },
  [`${NSID_BASE}.listGameSpecs`]: { method: "GET", handler: (e, input) => gamekaRwFree.listGameSpecs(e, input as any) },
  [`${NSID_BASE}.getBuildArtifact`]: { method: "GET", handler: (e, input) => gamekaRwFree.getBuildArtifact(e, input as any) },
  [`${NSID_BASE}.listBuildArtifacts`]: { method: "GET", handler: (e, input) => gamekaRwFree.listBuildArtifacts(e, input as any) },
  [`${NSID_BASE}.getGameQa`]: { method: "GET", handler: (e, input) => gamekaRwFree.getGameQa(e, input as any) },
  [`${NSID_BASE}.listGameQas`]: { method: "GET", handler: (e, input) => gamekaRwFree.listGameQas(e, input as any) },
  [`${NSID_BASE}.getGameTitle`]: { method: "GET", handler: (e, input) => gamekaRwFree.getGameTitle(e, input as any) },
  [`${NSID_BASE}.listGameTitles`]: { method: "GET", handler: (e, input) => gamekaRwFree.listGameTitles(e, input as any) },
  [`${NSID_BASE}.generateGame`]: { method: "POST", handler: (e, input) => gamekaRwFree.generateGame(e, input as any) },
  [`${NSID_BASE}.proposeGame`]: { method: "POST", handler: (e, input) => gamekaRwFree.proposeGame(e, input as any) },
  [`${NSID_BASE}.playtestGame`]: { method: "POST", handler: (e, input) => gamekaRwFree.playtestGame(e, input as any) },
  [`${NSID_BASE}.publishGame`]: { method: "POST", handler: (e, input) => gamekaRwFree.publishGame(e, input as any) },
  [`${NSID_BASE}.tickStudio`]: { method: "POST", handler: (e, input) => gamekaRwFree.tickStudio(e, input as any) },
};

function mapStatus(status?: string): number {
  if (status === "rejected") return 400;
  if (status === "notFound" || status === "invalidId") return 400;
  if (status === "alreadyExists") return 200;
  return 200;
}

function jsonResponse(body: unknown, status: number = 200, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...init?.headers },
    ...init,
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/xrpc/")) return jsonResponse({ error: "NotFound" }, 404);
    const nsid = url.pathname.slice("/xrpc/".length);
    const route = routes[nsid];
    if (!route) return jsonResponse({ error: "MethodNotFound", nsid }, 404);
    if (req.method !== route.method) return jsonResponse({ error: "MethodNotAllowed" }, 405);
    const bearerToken = extractBearerToken(req);
    const e = createAuthedEtzhayyim({
      env: { ACTOR_DID: env.ACTOR_DID, PDS_URL: env.PDS_URL, L2_RPC_URL: env.L2_RPC_URL, PDS_ACCESS_JWT: env.PDS_ACCESS_JWT, PDS_REFRESH_JWT: env.PDS_REFRESH_JWT },
      bearerToken,
    });
    let input: unknown;
    try {
      if (route.method === "POST") {
        input = await req.json().catch(() => ({}));
      } else {
        input = Object.fromEntries(url.searchParams.entries());
        const typed = input as Record<string, unknown>;
        if (typed.limit) typed.limit = Number(typed.limit);
        if (typed.offset) typed.offset = Number(typed.offset);
      }
    } catch (err) {
      return jsonResponse({ error: "InvalidInput", message: `Failed to parse ${route.method === "POST" ? "JSON" : "query params"}` }, 400);
    }
    try {
      const result = await route.handler(e, input);
      const status = mapStatus((result as Record<string, unknown>)?.status as string | undefined);
      return jsonResponse(result, status);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return jsonResponse({ error: "InternalError", message, nsid }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
