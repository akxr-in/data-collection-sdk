import type { DataCollection } from '../client';

export class QuizTracker {
    constructor(private dc: DataCollection) {}

    start(attemptId: string, payload: Record<string, unknown> = {}, moduleId?: string): void {
        this.dc.track('quiz_start', payload, { attemptId, moduleId });
    }

    answer(attemptId: string, payload: Record<string, unknown>, moduleId?: string): void {
        this.dc.track('quiz_answer', payload, { attemptId, moduleId });
    }

    /** Use on `document.visibilitychange` / `blur` to capture potential cheating signals. */
    tabSwitch(attemptId: string, moduleId?: string): void {
        this.dc.track('quiz_tab_switch', { at: new Date().toISOString() }, { attemptId, moduleId });
    }

    submit(attemptId: string, payload: Record<string, unknown> = {}, moduleId?: string): void {
        this.dc.track('quiz_submit', payload, { attemptId, moduleId });
    }
}
