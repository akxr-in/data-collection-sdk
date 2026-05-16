import type { DataCollection } from '../client';

export class VideoTracker {
    constructor(private dc: DataCollection) {}

    play(videoId: string, payload: Record<string, unknown> = {}, moduleId?: string): void {
        this.dc.track('video_play', { video_id: videoId, ...payload }, { moduleId });
    }

    pause(videoId: string, payload: Record<string, unknown> = {}, moduleId?: string): void {
        this.dc.track('video_pause', { video_id: videoId, ...payload }, { moduleId });
    }

    seek(videoId: string, fromSec: number, toSec: number, moduleId?: string): void {
        this.dc.track(
            'video_seek',
            { video_id: videoId, from_sec: fromSec, to_sec: toSec },
            { moduleId },
        );
    }

    progress(videoId: string, positionSec: number, durationSec: number, moduleId?: string): void {
        this.dc.track(
            'video_progress',
            { video_id: videoId, position_sec: positionSec, duration_sec: durationSec },
            { moduleId },
        );
    }

    complete(videoId: string, payload: Record<string, unknown> = {}, moduleId?: string): void {
        this.dc.track('video_complete', { video_id: videoId, ...payload }, { moduleId });
    }

    replay(videoId: string, payload: Record<string, unknown> = {}, moduleId?: string): void {
        this.dc.track('video_replay', { video_id: videoId, ...payload }, { moduleId });
    }
}
