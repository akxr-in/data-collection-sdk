export interface DataCollectionConfig {
    /** Base URL of the data-collection REST API, e.g. `https://api.example.com` */
    endpoint: string;
    /** Identifier of the learner producing the events */
    studentId: string;
    /** Course context the learner is in */
    courseId: string;
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
    /** Custom fetch (useful for tests or Node usage). Defaults to global fetch. */
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

export interface QueuedEvent {
    event_type: string;
    ts_client: string;
    module_id?: string;
    attempt_id?: string;
    payload: Record<string, unknown>;
}

export interface IngestEnvelope {
    sdk_version: string;
    session_id: string;
    student_id: string;
    batch_id: string;
    course_id: string;
    events: QueuedEvent[];
}

export interface IngestResponse {
    data: { accepted: number };
    message: string;
}

export interface EventQuery {
    studentId?: string;
    sessionId?: string;
    attemptId?: string;
    eventType?: string;
    moduleId?: string;
    from?: string;
    to?: string;
    limit?: number;
}
