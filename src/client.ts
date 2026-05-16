import { Transport } from './transport';
import { EventQueue } from './queue';
import { uuid } from './uuid';
import { VideoTracker } from './trackers/video';
import { QuizTracker } from './trackers/quiz';
import type {
    DataCollectionConfig,
    TrackOptions,
    EventQuery,
    IngestResponse,
} from './types';

export class DataCollection {
    private transport: Transport;
    private queue: EventQueue;
    private sessionId: string | null = null;
    private batchId: string = uuid();
    private sdkVersion: string;
    private studentId: string;
    private courseId: string;
    private unloadHandler?: () => void;
    private visibilityHandler?: () => void;

    readonly video: VideoTracker;
    readonly quiz: QuizTracker;

    constructor(cfg: DataCollectionConfig) {
        this.sdkVersion = cfg.sdkVersion ?? '1.0.0';
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

        this.queue.start();
        this.attachBrowserHandlers();
    }

    private ensureSession(): string {
        if (!this.sessionId) this.sessionId = uuid();
        return this.sessionId;
    }

    /** Begin a new learner session. Generates fresh session_id + batch_id and emits `session_start`. */
    startSession(meta: Record<string, unknown> = {}): string {
        this.sessionId = uuid();
        this.batchId = uuid();
        this.queue.start();
        this.track('session_start', meta);
        return this.sessionId;
    }

    /** Emit `session_end` and flush pending events. */
    async endSession(meta: Record<string, unknown> = {}): Promise<void> {
        this.track('session_end', meta);
        await this.flush();
    }

    /** Update the active learner/course (e.g. after sign-in). */
    identify(studentId: string, courseId?: string): void {
        this.studentId = studentId;
        if (courseId) this.courseId = courseId;
    }

    /** Enqueue a custom event. Most callers should use `video.*` / `quiz.*` helpers. */
    track(
        eventType: string,
        payload: Record<string, unknown> = {},
        opts: TrackOptions = {},
    ): void {
        this.ensureSession();
        this.queue.enqueue({
            event_type: eventType,
            ts_client: opts.tsClient ?? new Date().toISOString(),
            module_id: opts.moduleId,
            attempt_id: opts.attemptId,
            payload,
        });
    }

    /** Force-send any queued events. */
    flush(): Promise<void> {
        return this.queue.flush();
    }

    /** Current session_id, or null if no session has started yet. */
    get currentSessionId(): string | null {
        return this.sessionId;
    }

    /** Number of events waiting to be flushed. */
    get queueSize(): number {
        return this.queue.size();
    }

    // ---------- read-side wrappers ----------

    getEvents(q: EventQuery = {}): Promise<unknown> {
        return this.transport.get('/v1/events', {
            studentId: q.studentId,
            sessionId: q.sessionId,
            attemptId: q.attemptId,
            eventType: q.eventType,
            moduleId: q.moduleId,
            from: q.from,
            to: q.to,
            limit: q.limit,
        });
    }

    getSession(sessionId: string): Promise<unknown> {
        return this.transport.get(`/v1/sessions/${encodeURIComponent(sessionId)}`);
    }

    getStudentSessions(studentId: string): Promise<unknown> {
        return this.transport.get(`/v1/students/${encodeURIComponent(studentId)}/sessions`);
    }

    getVideo(studentId: string, videoId: string): Promise<unknown> {
        return this.transport.get(
            `/v1/students/${encodeURIComponent(studentId)}/videos/${encodeURIComponent(videoId)}`,
        );
    }

    getAttempt(attemptId: string): Promise<unknown> {
        return this.transport.get(`/v1/attempts/${encodeURIComponent(attemptId)}`);
    }

    computeVouch<T = unknown>(input: Record<string, unknown>): Promise<T> {
        return this.transport.post<T>('/v1/score/vouch', input);
    }

    /** Stop timers and detach browser listeners. Does not flush. */
    destroy(): void {
        this.queue.stop();
        if (typeof window !== 'undefined') {
            if (this.unloadHandler) window.removeEventListener('beforeunload', this.unloadHandler);
            if (this.visibilityHandler)
                document.removeEventListener('visibilitychange', this.visibilityHandler);
        }
    }

    private attachBrowserHandlers(): void {
        if (typeof window === 'undefined' || typeof document === 'undefined') return;
        this.unloadHandler = () => {
            this.queue.flushBeacon();
        };
        this.visibilityHandler = () => {
            if (document.visibilityState === 'hidden') this.queue.flushBeacon();
        };
        window.addEventListener('beforeunload', this.unloadHandler);
        document.addEventListener('visibilitychange', this.visibilityHandler);
    }
}

export type { IngestResponse };
