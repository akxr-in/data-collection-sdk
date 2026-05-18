import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventQueue } from "../queue";
import { Transport } from "../transport";

function makeTransport(
  handler: (path: string, body: unknown) => Response | Promise<Response>,
) {
  const fetchImpl = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        input instanceof Request
          ? input.url
          : typeof input === "string"
            ? input
            : (input as URL).toString();
      const path = new URL(url).pathname;
      let body: unknown;
      if (input instanceof Request) {
        const text = await input.clone().text();
        body = text ? JSON.parse(text) : undefined;
      } else if (init?.body) {
        body = JSON.parse(init.body as string);
      }
      return handler(path, body);
    },
  ) as unknown as typeof fetch;
  return { transport: new Transport("http://x", fetchImpl), fetchImpl };
}

const ctx = () => ({
  sessionId: "s1",
  batchId: "b1",
  studentId: "stu",
  courseId: "c",
  sdkVersion: "1.0.0",
});

describe("EventQueue", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("flushes when batch size is reached", async () => {
    const { transport, fetchImpl } = makeTransport(
      () =>
        new Response(JSON.stringify({ data: { accepted: 2 }, message: "ok" }), {
          status: 202,
          headers: { "content-type": "application/json" },
        }),
    );
    const q = new EventQueue(transport, ctx, {
      maxBatchSize: 2,
      maxQueueSize: 10,
      flushIntervalMs: 0,
      debug: false,
    });
    q.enqueue({ event_type: "session_start", ts_client: "t", payload: {} });
    q.enqueue({ event_type: "session_end", ts_client: "t", payload: {} });
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(q.size()).toBe(0);
  });

  it("re-queues batch on failure", async () => {
    const { transport } = makeTransport(
      () =>
        new Response(JSON.stringify({ message: "boom" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        }),
    );
    const onError = vi.fn();
    const q = new EventQueue(transport, ctx, {
      maxBatchSize: 1,
      maxQueueSize: 10,
      flushIntervalMs: 0,
      debug: false,
      onError,
    });
    q.enqueue({ event_type: "session_start", ts_client: "t", payload: {} });
    await new Promise((r) => setTimeout(r, 10));
    expect(q.size()).toBe(1);
    expect(onError).toHaveBeenCalled();
  });

  it("drops oldest when queue is full", () => {
    const { transport } = makeTransport(
      () => new Response("ok", { status: 202 }),
    );
    const q = new EventQueue(transport, ctx, {
      maxBatchSize: 100,
      maxQueueSize: 2,
      flushIntervalMs: 0,
      debug: false,
    });
    q.enqueue({ event_type: "session_start", ts_client: "t", payload: {} });
    q.enqueue({ event_type: "session_end", ts_client: "t", payload: {} });
    q.enqueue({ event_type: "focus_gain", ts_client: "t", payload: {} });
    expect(q.size()).toBe(2);
  });
});
