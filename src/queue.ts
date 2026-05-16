import type { QueuedEvent } from './types';
import type { Transport } from './transport';

export interface EnvelopeContext {
    sessionId: string;
    batchId: string;
    studentId: string;
    courseId: string;
    sdkVersion: string;
}

export interface EventQueueOptions {
    maxBatchSize: number;
    maxQueueSize: number;
    flushIntervalMs: number;
    debug: boolean;
    onError?: (err: Error, events: QueuedEvent[]) => void;
}

export class EventQueue {
    private events: QueuedEvent[] = [];
    private timer: ReturnType<typeof setInterval> | null = null;
    private flushing = false;

    constructor(
        private transport: Transport,
        private getContext: () => EnvelopeContext,
        private opts: EventQueueOptions,
    ) {}

    start(): void {
        if (this.timer || this.opts.flushIntervalMs <= 0) return;
        this.timer = setInterval(() => {
            void this.flush();
        }, this.opts.flushIntervalMs);
    }

    stop(): void {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
    }

    size(): number {
        return this.events.length;
    }

    enqueue(evt: QueuedEvent): void {
        if (this.events.length >= this.opts.maxQueueSize) {
            if (this.opts.debug) console.warn('[data-collection] queue full, dropping oldest');
            this.events.shift();
        }
        this.events.push(evt);
        if (this.events.length >= this.opts.maxBatchSize) void this.flush();
    }

    async flush(): Promise<void> {
        if (this.flushing || this.events.length === 0) return;
        this.flushing = true;
        const batch = this.events.splice(0, this.opts.maxBatchSize);
        try {
            const ctx = this.getContext();
            await this.transport.post('/v1/events', {
                sdk_version: ctx.sdkVersion,
                session_id: ctx.sessionId,
                student_id: ctx.studentId,
                batch_id: ctx.batchId,
                course_id: ctx.courseId,
                events: batch,
            });
            if (this.opts.debug) console.log(`[data-collection] flushed ${batch.length} events`);
        } catch (err) {
            // Put the batch back at the front so order is preserved on retry
            this.events.unshift(...batch);
            if (this.opts.onError) this.opts.onError(err as Error, batch);
            else if (this.opts.debug) console.error('[data-collection] flush failed', err);
        } finally {
            this.flushing = false;
        }
    }

    /** Synchronous best-effort flush via sendBeacon, used during page unload. */
    flushBeacon(): boolean {
        if (this.events.length === 0) return true;
        const batch = this.events.splice(0, this.opts.maxBatchSize);
        const ctx = this.getContext();
        const ok = this.transport.beacon('/v1/events', {
            sdk_version: ctx.sdkVersion,
            session_id: ctx.sessionId,
            student_id: ctx.studentId,
            batch_id: ctx.batchId,
            course_id: ctx.courseId,
            events: batch,
        });
        if (!ok) this.events.unshift(...batch);
        return ok;
    }
}
