import { Transport, TransportError } from "./transport";
import { EventQueue } from "./queue";
import { uuid } from "./uuid";
import { VideoTracker } from "./trackers/video";
import { QuizTracker } from "./trackers/quiz";
import { TextTracker } from "./trackers/text";
import { FocusTracker } from "./trackers/focus";
import type {
  DataCollectionConfig,
  TrackOptions,
  EventQuery,
  EventType,
  PayloadFor,
  QueuedEvent,
  AkxrEvent,
  SessionSummary,
  VideoSummary,
  QuizAttemptSummary,
  VouchRequest,
  VouchResult,
  HealthResponse,
} from "./types";

export class DataCollection {
  private transport: Transport;
  private queue: EventQueue;
  private sessionId: string | null = null;
  private batchId: string = uuid();
  private sdkVersion: string;
  private studentId: string;
  private courseId?: string;
  private unloadHandler?: () => void;
  private visibilityHandler?: () => void;

  readonly video: VideoTracker;
  readonly quiz: QuizTracker;
  readonly text: TextTracker;
  readonly focus: FocusTracker;

  constructor(cfg: DataCollectionConfig) {
    this.sdkVersion = cfg.sdkVersion ?? "1.0.0";
    this.studentId = cfg.studentId;
    this.courseId = cfg.courseId;

    this.transport = new Transport(cfg.endpoint, cfg.fetch);
    this.queue = new EventQueue(
      this.transport,
      () => ({
        sessionId: this.sessionId ?? this.ensureSession(),
        batchId: this.batchId,
        studentId: this.studentId,
        courseId: this.courseId,
        sdkVersion: this.sdkVersion,
      }),
      {
        maxBatchSize: Math.min(cfg.maxBatchSize ?? 50, 100),
        maxQueueSize: cfg.maxQueueSize ?? 500,
        flushIntervalMs: cfg.flushIntervalMs ?? 5000,
        debug: cfg.debug ?? false,
        onError: cfg.onError,
      },
    );

    this.video = new VideoTracker(this);
    this.quiz = new QuizTracker(this);
    this.text = new TextTracker(this);
    this.focus = new FocusTracker(this);

    this.queue.start();
    this.attachBrowserHandlers();
  }

  /** Direct access to the underlying openapi-fetch typed client (escape hatch). */
  get raw() {
    return this.transport.client;
  }

  private ensureSession(): string {
    if (!this.sessionId) this.sessionId = uuid();
    return this.sessionId;
  }

  /** Begin a new learner session. Generates fresh session_id + batch_id and emits `session_start`. */
  startSession(): string {
    this.sessionId = uuid();
    this.batchId = uuid();
    this.queue.start();
    this.track("session_start", {});
    return this.sessionId;
  }

  /** Emit `session_end` and flush pending events. */
  async endSession(): Promise<void> {
    this.track("session_end", {});
    await this.flush();
  }

  /** Update the active learner/course (e.g. after sign-in). */
  identify(studentId: string, courseId?: string): void {
    this.studentId = studentId;
    if (courseId !== undefined) this.courseId = courseId;
  }

  /**
   * Enqueue a typed event. `payload` is type-checked against the schema for the
   * given `eventType` (discriminated union from the OpenAPI spec).
   * Most callers should use the `video.*` / `quiz.*` / `text.*` / `focus.*` helpers.
   */
  track<T extends EventType>(
    eventType: T,
    payload: PayloadFor<T>,
    opts: TrackOptions = {},
  ): void {
    this.ensureSession();
    // Cast: TS can't narrow the union after we re-pack the fields, but the
    // payload was just type-checked above against PayloadFor<T>.
    this.queue.enqueue({
      event_type: eventType,
      ts_client: opts.tsClient ?? new Date().toISOString(),
      module_id: opts.moduleId ?? null,
      attempt_id: opts.attemptId ?? null,
      payload,
    } as QueuedEvent);
  }

  flush(): Promise<void> {
    return this.queue.flush();
  }

  get currentSessionId(): string | null {
    return this.sessionId;
  }
  get queueSize(): number {
    return this.queue.size();
  }

  // ---------- typed read-side wrappers ----------

  async healthz(): Promise<HealthResponse> {
    const { data, response } = await this.transport.client.GET("/healthz");
    if (!data) throw new TransportError(response.status, await response.text());
    return data;
  }

  async getEvents(
    q: EventQuery = {},
  ): Promise<{ data: AkxrEvent[]; message: string }> {
    const { data, error, response } = await this.transport.client.GET(
      "/v1/events",
      {
        params: { query: q },
      },
    );
    if (error || !data) throw new TransportError(response.status, error);
    return data;
  }

  async getSession(
    sessionId: string,
  ): Promise<{ data: SessionSummary; message: string }> {
    const { data, error, response } = await this.transport.client.GET(
      "/v1/sessions/{sessionId}",
      { params: { path: { sessionId } } },
    );
    if (error || !data) throw new TransportError(response.status, error);
    return data;
  }

  async getStudentSessions(
    studentId: string,
  ): Promise<{ data: SessionSummary[]; message: string }> {
    const { data, error, response } = await this.transport.client.GET(
      "/v1/students/{studentId}/sessions",
      { params: { path: { studentId } } },
    );
    if (error || !data) throw new TransportError(response.status, error);
    return data;
  }

  async getVideo(
    studentId: string,
    videoId: string,
  ): Promise<{ data: VideoSummary; message: string }> {
    const { data, error, response } = await this.transport.client.GET(
      "/v1/students/{studentId}/videos/{videoId}",
      { params: { path: { studentId, videoId } } },
    );
    if (error || !data) throw new TransportError(response.status, error);
    return data;
  }

  async getAttempt(
    attemptId: string,
  ): Promise<{ data: QuizAttemptSummary; message: string }> {
    const { data, error, response } = await this.transport.client.GET(
      "/v1/attempts/{attemptId}",
      { params: { path: { attemptId } } },
    );
    if (error || !data) throw new TransportError(response.status, error);
    return data;
  }

  async computeVouch(
    input: VouchRequest,
  ): Promise<{ data: VouchResult; message: string }> {
    const { data, error, response } = await this.transport.client.POST(
      "/v1/score/vouch",
      {
        body: input,
      },
    );
    if (error || !data) throw new TransportError(response.status, error);
    return data;
  }

  destroy(): void {
    this.queue.stop();
    if (typeof window !== "undefined") {
      if (this.unloadHandler)
        window.removeEventListener("beforeunload", this.unloadHandler);
      if (this.visibilityHandler)
        document.removeEventListener(
          "visibilitychange",
          this.visibilityHandler,
        );
    }
  }

  private attachBrowserHandlers(): void {
    if (typeof window === "undefined" || typeof document === "undefined")
      return;
    this.unloadHandler = () => {
      this.queue.flushBeacon();
    };
    this.visibilityHandler = () => {
      if (document.visibilityState === "hidden") this.queue.flushBeacon();
    };
    window.addEventListener("beforeunload", this.unloadHandler);
    document.addEventListener("visibilitychange", this.visibilityHandler);
  }
}
