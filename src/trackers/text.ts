import type { DataCollection } from '../client';
import type { TrackOptions } from '../types';

/** Helpers for text reading events (`text_open` / `text_scroll` / `text_close` / `highlight_add` / `note_add`). */
export class TextTracker {
    constructor(private dc: DataCollection) {}

    open(textId: string, opts: TrackOptions = {}): void {
        this.dc.track('text_open', { text_id: textId }, opts);
    }

    scroll(
        textId: string,
        scrollPct: number,
        visibleRange?: { start: number; end: number },
        opts: TrackOptions = {},
    ): void {
        this.dc.track(
            'text_scroll',
            visibleRange
                ? { text_id: textId, scroll_pct: scrollPct, visible_range: visibleRange }
                : { text_id: textId, scroll_pct: scrollPct },
            opts,
        );
    }

    close(textId: string, timeOpenSec: number, opts: TrackOptions = {}): void {
        this.dc.track('text_close', { text_id: textId, time_open_sec: timeOpenSec }, opts);
    }

    highlight(
        textId: string,
        range: { start: number; end: number },
        text: string,
        opts: TrackOptions = {},
    ): void {
        this.dc.track('highlight_add', { text_id: textId, range, text }, opts);
    }

    note(textId: string, noteId: string, opts: TrackOptions = {}): void {
        this.dc.track('note_add', { text_id: textId, note_id: noteId }, opts);
    }
}
