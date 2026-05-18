import type { components, paths } from "./generated/schema";

/** Re-exports from the generated OpenAPI schema. Use these in app code for full type safety. */
export type Schemas = components["schemas"];
export type IngestEventsRequest = Schemas["IngestEventsRequest"];
export type IngestResult = Schemas["IngestResult"];
export type AkxrEvent = Schemas["AkxrEvent"];
export type SessionSummary = Schemas["SessionSummary"];
export type VideoSummary = Schemas["VideoSummary"];
export type QuizAttemptSummary = Schemas["QuizAttemptSummary"];
export type VouchRequest = Schemas["VouchRequest"];
export type VouchResult = Schemas["VouchResult"];
export type StudentMetrics = Schemas["StudentMetrics"];
export type StudentVouchSummary = Schemas["StudentVouchSummary"];
export type HealthResponse = Schemas["HealthResponse"];
export type EventType = Schemas["EventType"];

/** A single queued event prior to being wrapped in an envelope (discriminated by `event_type`). */
export type QueuedEvent = IngestEventsRequest["events"][number];

/** Payload shape required for a given `event_type`. */
export type PayloadFor<T extends EventType> = Extract<
  QueuedEvent,
  { event_type: T }
>["payload"];

/** Query parameters accepted by `GET /v1/events` (snake_case matches server). */
export type EventQuery = NonNullable<
  paths["/v1/events"]["get"]["parameters"]["query"]
>;

export interface DataCollectionConfig {
  /** Base URL of the data-collection REST API, e.g. `http://localhost:3399` */
  endpoint: string;
  /** Identifier of the learner producing the events */
  studentId: string;
  /** Course context the learner is in (optional per spec) */
  courseId?: string;
  /** SDK version reported to the server. Major must match server's SUPPORTED_SDK_MAJOR (default `1.0.0`) */
  sdkVersion?: string;
  /** Periodic flush interval in ms (default 5000). Set to 0 to disable timer-based flushing. */
  flushIntervalMs?: number;
  /** Trigger flush when the in-memory batch reaches this size (default 50, server caps at 100). */
  maxBatchSize?: number;
  /** Hard cap on queued events before oldest are dropped (default 500). */
  maxQueueSize?: number;
  /** Verbose console logging */
  debug?: boolean;
  /** Custom fetch (useful for tests or non-browser usage). Defaults to global fetch. */
  fetch?: typeof fetch;
  /** Called when a flush fails after re-queuing the batch */
  onError?: (err: Error, events: QueuedEvent[]) => void;
}

export interface TrackOptions {
  moduleId?: string;
  attemptId?: string;
  /** Override client timestamp (ISO8601). Defaults to `new Date().toISOString()`. */
  tsClient?: string;
}
