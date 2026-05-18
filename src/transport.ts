import createClient, { type Client } from "openapi-fetch";
import type { paths } from "./generated/schema";

export class TransportError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(
      `HTTP ${status}: ${typeof body === "string" ? body : JSON.stringify(body)}`,
    );
    this.name = "TransportError";
  }
}

/**
 * Thin wrapper around `openapi-fetch` so callers get end-to-end typed access
 * to every path/param/body/response, plus a `sendBeacon` escape hatch the
 * generated client doesn't model (used during page unload).
 */
export class Transport {
  readonly client: Client<paths>;
  private baseUrl: string;

  constructor(endpoint: string, fetchImpl?: typeof fetch) {
    this.baseUrl = endpoint.replace(/\/$/, "");
    this.client = createClient<paths>({
      baseUrl: this.baseUrl,
      ...(fetchImpl ? { fetch: fetchImpl } : {}),
    });
  }

  /**
   * Fire-and-forget POST via `navigator.sendBeacon`. Used on
   * `beforeunload` / `visibilitychange:hidden` to flush a final batch
   * even as the page closes. Returns false if sendBeacon is unavailable
   * or refuses the payload.
   */
  beacon(path: string, body: unknown): boolean {
    if (
      typeof navigator === "undefined" ||
      typeof navigator.sendBeacon !== "function"
    ) {
      return false;
    }
    const blob = new Blob([JSON.stringify(body)], { type: "application/json" });
    try {
      return navigator.sendBeacon(`${this.baseUrl}${path}`, blob);
    } catch {
      return false;
    }
  }
}
