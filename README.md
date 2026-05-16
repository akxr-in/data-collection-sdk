# @wagmi/data-collection-sdk

Browser-first TypeScript SDK for the wagmi **data-collection REST APIs**. Wraps the ingest envelope, batches events in memory, auto-flushes on a timer / size threshold, and uses `navigator.sendBeacon` to ship the last batch as the page unloads.

Types and request/response shapes are **generated from the server's OpenAPI spec** (`openapi.json` at the repo root) via [`openapi-typescript`](https://openapi-ts.dev/), and HTTP calls go through [`openapi-fetch`](https://openapi-ts.dev/openapi-fetch/) — so the entire surface is end-to-end typed against the server contract. Regenerate after a backend change with `pnpm gen:types:remote` (pulls from `http://localhost:3399/openapi.json`).

## Install

```bash
pnpm add @wagmi/data-collection-sdk
# or
npm i @wagmi/data-collection-sdk
```

## Quick start

```ts
import { DataCollection } from '@wagmi/data-collection-sdk';

const dc = new DataCollection({
    endpoint: 'https://api.example.com',
    studentId: 'stu_alice',
    courseId: 'ml_101',
    // optional
    sdkVersion: '1.0.0',     // major must match server's SUPPORTED_SDK_MAJOR
    flushIntervalMs: 5000,
    maxBatchSize: 50,         // server cap is 100
    debug: true,
});

dc.startSession({ device: 'web' });

// custom event
dc.track('text_read', { section: 'intro', time_sec: 42 }, { moduleId: 'm1' });

// video helpers
dc.video.play('vid_42', { position_sec: 0 }, 'm1');
dc.video.seek('vid_42', 30, 60, 'm1');
dc.video.complete('vid_42', { position_sec: 600 }, 'm1');

// quiz helpers
dc.quiz.start('att_1', { quiz_id: 'q1' }, 'm1');
dc.quiz.tabSwitch('att_1');
dc.quiz.answer('att_1', { question_id: 'q1', answer: 'B' });
dc.quiz.submit('att_1', { score: 0.8 });

await dc.endSession();
```

## Read APIs

```ts
await dc.getSession('sess_001');
await dc.getStudentSessions('stu_alice');
await dc.getVideo('stu_alice', 'vid_42');
await dc.getAttempt('att_1');
await dc.getEvents({ student_id: 'stu_alice', since: '2026-05-01T00:00:00Z', limit: 100 });

const vouch = await dc.computeVouch({
    student_id: 'stu_alice',
    // C/E/M/I/P inputs per server validation schema
});
```

## How batching works

| Trigger | Behavior |
|---|---|
| `enqueue()` reaches `maxBatchSize` | immediate flush |
| every `flushIntervalMs` | flush whatever's queued |
| HTTP failure | batch is re-prepended; `onError` callback fires |
| `beforeunload` / `visibilitychange: hidden` | `navigator.sendBeacon` flushes a final batch |
| `flush()` | manual flush (returns a Promise) |

Queue is capped at `maxQueueSize` (default 500); oldest events are dropped first. Re-queued failed batches preserve order.

## Config reference

| Option | Default | Notes |
|---|---|---|
| `endpoint` | — | Base URL of the API |
| `studentId` | — | Learner id |
| `courseId` | — | Course context |
| `sdkVersion` | `'1.0.0'` | Server enforces major version |
| `flushIntervalMs` | `5000` | 0 = disable timer-based flush |
| `maxBatchSize` | `50` | Hard-capped at 100 (server limit) |
| `maxQueueSize` | `500` | Drop oldest beyond this |
| `debug` | `false` | Verbose logging |
| `fetch` | global `fetch` | Override for tests / Node |
| `onError` | — | `(err, events) => void` after a failed flush |

## Build

```bash
pnpm install
pnpm build      # tsup -> dist/ (esm + cjs + d.ts)
pnpm test       # vitest
pnpm typecheck
```

## Server contract

POSTs `/v1/events` with:

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
            "module_id": "m1",
            "attempt_id": null,
            "payload": { "video_id": "vid_42" }
        }
    ]
}
```

`session_id` and `batch_id` are SDK-generated UUIDs (`crypto.randomUUID`). `ts_client` is stamped at `track()` time, not at flush time.
