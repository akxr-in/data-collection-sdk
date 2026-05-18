import type { DataCollection } from "../client";
import type { TrackOptions, PayloadFor } from "../types";

/** Helpers for quiz / question events. */
export class QuizTracker {
  constructor(private dc: DataCollection) {}

  start(
    attemptId: string,
    quizId: string,
    opts: Omit<TrackOptions, "attemptId"> = {},
  ): void {
    this.dc.track("quiz_start", { quiz_id: quizId }, { ...opts, attemptId });
  }

  submit(
    attemptId: string,
    result: PayloadFor<"quiz_submit"> = {},
    opts: Omit<TrackOptions, "attemptId"> = {},
  ): void {
    this.dc.track("quiz_submit", result, { ...opts, attemptId });
  }

  autosave(
    attemptId: string,
    payload: PayloadFor<"quiz_autosave">,
    opts: Omit<TrackOptions, "attemptId"> = {},
  ): void {
    this.dc.track("quiz_autosave", payload, { ...opts, attemptId });
  }

  questionFocus(
    attemptId: string,
    questionId: string,
    opts: Omit<TrackOptions, "attemptId"> = {},
  ): void {
    this.dc.track(
      "question_focus",
      { question_id: questionId },
      { ...opts, attemptId },
    );
  }

  answerChange(
    attemptId: string,
    questionId: string,
    opts: Omit<TrackOptions, "attemptId"> = {},
  ): void {
    this.dc.track(
      "question_answer_change",
      { question_id: questionId },
      { ...opts, attemptId },
    );
  }
}
