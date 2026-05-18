import type { DataCollection } from "../client";
import type { TrackOptions } from "../types";

/** Helpers for video events (`video_play` / `video_pause` / `video_seek` / `video_complete` / `playback_rate_change`). */
export class VideoTracker {
  constructor(private dc: DataCollection) {}

  play(
    videoId: string,
    positionSecAfter: number,
    opts: TrackOptions = {},
  ): void {
    this.dc.track(
      "video_play",
      { video_id: videoId, position_sec_after: positionSecAfter },
      opts,
    );
  }

  pause(
    videoId: string,
    positionSecAfter: number,
    opts: TrackOptions = {},
  ): void {
    this.dc.track(
      "video_pause",
      { video_id: videoId, position_sec_after: positionSecAfter },
      opts,
    );
  }

  seek(
    videoId: string,
    positionSecBefore: number,
    positionSecAfter: number,
    opts: TrackOptions = {},
  ): void {
    this.dc.track(
      "video_seek",
      {
        video_id: videoId,
        position_sec_before: positionSecBefore,
        position_sec_after: positionSecAfter,
      },
      opts,
    );
  }

  complete(videoId: string, opts: TrackOptions = {}): void {
    this.dc.track("video_complete", { video_id: videoId }, opts);
  }

  playbackRateChange(
    videoId: string,
    playbackRate: number,
    opts: TrackOptions = {},
  ): void {
    this.dc.track(
      "playback_rate_change",
      { video_id: videoId, playback_rate: playbackRate },
      opts,
    );
  }
}
