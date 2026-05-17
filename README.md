# @akxr-in/data-collection-sdk

Browser-first TypeScript SDK for the wagmi **data-collection REST APIs**.

- Auto-batches events in memory and ships them on a timer / batch-size threshold
- Falls back to `navigator.sendBeacon` on page unload so the last batch is never lost
- Fully typed against the server's OpenAPI spec — generated via [`openapi-typescript`](https://openapi-ts.dev/), transport via [`openapi-fetch`](https://openapi-ts.dev/openapi-fetch/)
- Convenience trackers for **video / quiz / text / focus** events plus session lifecycle
- ~11 KB ESM, zero runtime deps beyond `openapi-fetch`

---

## Install (from GitHub Packages)

This SDK is published to the **GitHub Packages** registry under the `@akxr-in` scope. Consumers need two things:

1. **Scope mapping** — commit a repo-local `.npmrc` (no secrets):

   ```ini
   @akxr-in:registry=https://npm.pkg.github.com
   ```

2. **Auth** — a GitHub Classic PAT with `read:packages`, kept out of the repo. Add it once to your user-global `~/.npmrc`:

   ```ini
   //npm.pkg.github.com/:_authToken=ghp_xxxxxxxxxxxx
   ```

   In CI, `actions/setup-node` with `registry-url: https://npm.pkg.github.com` injects the token automatically from `${{ secrets.GH_TOKEN }}`.

Then:

```bash
pnpm add @akxr-in/data-collection-sdk
```

## Quick start

```ts
import { DataCollection } from "@akxr-in/data-collection-sdk";

const dc = new DataCollection({
  endpoint: "https://collect.example.com",
  studentId: "stu_alice",
  courseId: "ml_101",
});

const sessionId = dc.startSession();

dc.video.play("vid_42", 0);
dc.video.seek("vid_42", 30, 120);
dc.video.complete("vid_42");

dc.quiz.start("att_1", "q1");
dc.quiz.answerChange("att_1", "q1");
dc.quiz.submit("att_1", { score_pct: 80, score_raw: 8 });

await dc.endSession(); // flushes pending events
```

## Configuration

`new DataCollection(config)` accepts:

| Option            | Default        | Notes                                                                 |
| ----------------- | -------------- | --------------------------------------------------------------------- |
| `endpoint`        | required       | Base URL of the data-collection API                                   |
| `studentId`       | required       | Learner identifier sent on every envelope                             |
| `courseId`        | `null`         | Optional course context                                               |
| `sdkVersion`      | `'1.0.0'`      | Major must match server's `SUPPORTED_SDK_MAJOR`                       |
| `flushIntervalMs` | `5000`         | Timer-based flush. `0` disables.                                      |
| `maxBatchSize`    | `50`           | Flush when queue reaches this. Server caps at 100.                    |
| `maxQueueSize`    | `500`          | Drop oldest beyond this                                               |
| `debug`           | `false`        | Verbose console logging                                               |
| `fetch`           | global `fetch` | Override for tests / SSR                                              |
| `onError`         | —              | `(err, events) => void` after a failed flush (batch is auto-requeued) |

### Environment wiring per framework

The SDK itself never reads `process.env`. Pass values through the constructor from whatever env mechanism your host app uses.

```ts
// Vite / React
new DataCollection({
  endpoint: import.meta.env.VITE_DC_ENDPOINT,
  studentId: currentUser.id,
  courseId: activeCourse.id,
});

// Next.js (browser bundle)
new DataCollection({
  endpoint: process.env.NEXT_PUBLIC_DC_ENDPOINT!,
  studentId: session.user.id,
  courseId,
});

// Node (SSR / server-side)
new DataCollection({
  endpoint: process.env.DC_ENDPOINT!,
  studentId,
  courseId,
});
```

Recommended env names (used by the demo and `.env.example` in this repo):

```
DC_ENDPOINT=http://localhost:3399
DC_STUDENT_ID=...
DC_COURSE_ID=...
DC_SDK_VERSION=1.0.0
DC_FLUSH_INTERVAL_MS=5000
DC_MAX_BATCH_SIZE=50
DC_MAX_QUEUE_SIZE=500
DC_DEBUG=false
```

## Event tracking

All 19 server-side `EventType`s have a typed helper. Every helper accepts a trailing `opts: { moduleId?, attemptId?, tsClient? }`.

### Session lifecycle

| Method              | Event           | Notes                                       |
| ------------------- | --------------- | ------------------------------------------- |
| `dc.startSession()` | `session_start` | Generates a fresh `session_id` + `batch_id` |
| `dc.endSession()`   | `session_end`   | Emits the event and awaits a final flush    |

### `dc.video.*`

| Method                                     | Event                  | Payload                                                 |
| ------------------------------------------ | ---------------------- | ------------------------------------------------------- |
| `play(videoId, positionSecAfter, opts?)`   | `video_play`           | `{ video_id, position_sec_after }`                      |
| `pause(videoId, positionSecAfter, opts?)`  | `video_pause`          | `{ video_id, position_sec_after }`                      |
| `seek(videoId, before, after, opts?)`      | `video_seek`           | `{ video_id, position_sec_before, position_sec_after }` |
| `complete(videoId, opts?)`                 | `video_complete`       | `{ video_id }`                                          |
| `playbackRateChange(videoId, rate, opts?)` | `playback_rate_change` | `{ video_id, playback_rate }`                           |

### `dc.text.*`

| Method                                            | Event           | Payload                                   |
| ------------------------------------------------- | --------------- | ----------------------------------------- |
| `open(textId, opts?)`                             | `text_open`     | `{ text_id }`                             |
| `scroll(textId, scrollPct, visibleRange?, opts?)` | `text_scroll`   | `{ text_id, scroll_pct, visible_range? }` |
| `close(textId, timeOpenSec, opts?)`               | `text_close`    | `{ text_id, time_open_sec }`              |
| `highlight(textId, range, text, opts?)`           | `highlight_add` | `{ text_id, range, text }`                |
| `note(textId, noteId, opts?)`                     | `note_add`      | `{ text_id, note_id }`                    |

### `dc.quiz.*`

`attemptId` is automatically attached to the envelope on every quiz event.

| Method                                                            | Event                    | Payload           |
| ----------------------------------------------------------------- | ------------------------ | ----------------- |
| `start(attemptId, quizId, opts?)`                                 | `quiz_start`             | `{ quiz_id }`     |
| `submit(attemptId, { score_raw?, score_pct? }, opts?)`            | `quiz_submit`            | scores            |
| `autosave(attemptId, { question_id?, answers_snapshot? }, opts?)` | `quiz_autosave`          | snapshot          |
| `questionFocus(attemptId, questionId, opts?)`                     | `question_focus`         | `{ question_id }` |
| `answerChange(attemptId, questionId, opts?)`                      | `question_answer_change` | `{ question_id }` |

### `dc.focus.*`

Wire these to `document.visibilitychange` / window `blur` / `focus` — they feed the Integrity factor of Vouch scoring.

| Method              | Event        |
| ------------------- | ------------ |
| `focus.gain(opts?)` | `focus_gain` |
| `focus.loss(opts?)` | `focus_loss` |

### Escape hatch — `dc.track()`

Any event can be sent directly. `payload` is statically type-checked per `eventType` (discriminated union, derived from the OpenAPI spec).

```ts
dc.track(
  "video_seek",
  {
    video_id: "vid_42",
    position_sec_before: 30,
    position_sec_after: 120,
  },
  { moduleId: "m_intro" },
);
```

## Read APIs (typed)

```ts
await dc.healthz();
await dc.getEvents({
  student_id: "stu_alice",
  since: "2026-05-01T00:00:00Z",
  limit: 100,
});
await dc.getSession(sessionId);
await dc.getStudentSessions("stu_alice");
await dc.getVideo("stu_alice", "vid_42");
await dc.getAttempt("att_1");
await dc.computeVouch({
  gate: { num_assessments: 4, num_assignments: 2, days_enrolled: 30 },
  C_inputs: {
    /* ... */
  },
  E_inputs: {
    /* ... */
  },
  M_inputs: {
    /* ... */
  },
  I_inputs: {
    /* ... */
  },
  // P_inputs optional — weights re-normalize if omitted
});
```

Need a path the SDK doesn't wrap? Use the underlying typed client:

```ts
const { data, error } = await dc.raw.GET("/v1/sessions/{sessionId}", {
  params: { path: { sessionId } },
});
```

## Batching behavior

| Trigger                                    | What happens                                                      |
| ------------------------------------------ | ----------------------------------------------------------------- |
| `enqueue()` reaches `maxBatchSize`         | immediate flush                                                   |
| every `flushIntervalMs`                    | flush whatever's queued                                           |
| HTTP failure                               | batch is re-prepended (order preserved); `onError` callback fires |
| `beforeunload` / `visibilitychange:hidden` | `navigator.sendBeacon` ships a final batch                        |
| `flush()`                                  | manual flush (returns a Promise)                                  |

The queue is capped at `maxQueueSize`; once full, the **oldest** event is dropped first (so the most recent activity is preserved). `ts_client` is stamped at `track()` time, not at flush time — accurate timing under batching.

## Server contract (envelope shape)

```json
{
  "sdk_version": "1.0.0",
  "session_id": "<uuid>",
  "student_id": "stu_alice",
  "batch_id": "<uuid>",
  "course_id": "ml_101",
  "events": [
    {
      "event_type": "video_play",
      "ts_client": "2026-05-17T10:00:00.000Z",
      "module_id": "m_intro",
      "attempt_id": null,
      "payload": { "video_id": "vid_42", "position_sec_after": 0 }
    }
  ]
}
```

## Development

```bash
pnpm install
pnpm build              # tsup → dist/ (ESM + CJS + .d.ts)
pnpm test               # vitest
pnpm typecheck          # tsc --noEmit
pnpm gen:types          # regenerate types from local openapi.json
pnpm gen:types:remote   # regenerate types from http://localhost:3399/openapi.json
pnpm demo               # run demo/run.ts end-to-end against the backend
```

The generated client lives at `src/generated/schema.ts` — **do not edit by hand**. After any backend change, run `pnpm gen:types:remote` and let TypeScript flag the breakage.

## Publishing a new version

CI (`.github/workflows/publish.yml`) publishes on every GitHub Release. To cut one:

```bash
pnpm version patch              # or minor / major — bumps version + tags
git push --follow-tags
gh release create "v$(node -p "require('./package.json').version")" --generate-notes
```

The workflow then runs `typecheck → test → build → pnpm publish` against `https://npm.pkg.github.com` using the auto-injected `GH_TOKEN` (no manual secret needed).

To publish manually from your laptop, set `GH_TOKEN` and run:

```bash
pnpm build
pnpm publish --no-git-checks
```

The repo's committed `.npmrc` already points the `@akxr-in` scope at GitHub Packages.

## License

UNLICENSED — internal to akxr.
