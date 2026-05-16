export class TransportError extends Error {
    constructor(
        public status: number,
        public body: string,
    ) {
        super(`HTTP ${status}: ${body}`);
        this.name = 'TransportError';
    }
}

export class Transport {
    private baseUrl: string;
    private fetchImpl: typeof fetch;

    constructor(endpoint: string, fetchImpl?: typeof fetch) {
        this.baseUrl = endpoint.replace(/\/$/, '');
        const resolved = fetchImpl ?? (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : undefined);
        if (!resolved) {
            throw new Error('No fetch implementation available. Pass `fetch` in config.');
        }
        this.fetchImpl = resolved;
    }

    async post<T>(path: string, body: unknown): Promise<T> {
        const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new TransportError(res.status, text);
        }
        return (await res.json()) as T;
    }

    async get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
        const url = new URL(`${this.baseUrl}${path}`);
        if (params) {
            for (const [k, v] of Object.entries(params)) {
                if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
            }
        }
        const res = await this.fetchImpl(url.toString());
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new TransportError(res.status, text);
        }
        return (await res.json()) as T;
    }

    /**
     * Fire-and-forget POST using `navigator.sendBeacon`. Used on `beforeunload`
     * / `visibilitychange:hidden` to flush a final batch even as the page closes.
     * Returns false if sendBeacon is unavailable or refuses the payload (e.g. too large).
     */
    beacon(path: string, body: unknown): boolean {
        if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
            return false;
        }
        const blob = new Blob([JSON.stringify(body)], { type: 'application/json' });
        try {
            return navigator.sendBeacon(`${this.baseUrl}${path}`, blob);
        } catch {
            return false;
        }
    }
}
