import type { DataCollection } from "../client";
import type { TrackOptions } from "../types";

/**
 * Helpers for window-focus events (`focus_gain` / `focus_loss`).
 * Useful inputs for the Integrity factor of Vouch scoring.
 */
export class FocusTracker {
  constructor(private dc: DataCollection) {}

  gain(opts: TrackOptions = {}): void {
    this.dc.track("focus_gain", {}, opts);
  }

  loss(opts: TrackOptions = {}): void {
    this.dc.track("focus_loss", {}, opts);
  }
}
