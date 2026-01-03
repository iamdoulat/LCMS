/**
 * Request queue for offline support
 * Stores failed requests and retries when online
 */

interface QueuedRequest {
    id: string;
    url: string;
    method: string;
    body?: any;
    timestamp: number;
}

class RequestQueue {
    private queue: QueuedRequest[] = [];
    private readonly queueKey = 'offline_request_queue';

    constructor() {
        this.loadQueue();
        this.monitorOnline();
    }

    private loadQueue() {
        if (typeof window === 'undefined') return;

        try {
            const stored = localStorage.getItem(this.queueKey);
            if (stored) {
                this.queue = JSON.parse(stored);
            }
        } catch (error) {
            console.error('Failed to load request queue:', error);
        }
    }

    private saveQueue() {
        if (typeof window === 'undefined') return;

        try {
            localStorage.setItem(this.queueKey, JSON.stringify(this.queue));
        } catch (error) {
            console.error('Failed to save request queue:', error);
        }
    }

    add(request: Omit<QueuedRequest, 'id' | 'timestamp'>) {
        const queuedRequest: QueuedRequest = {
            ...request,
            id: `${Date.now()}_${Math.random()}`,
            timestamp: Date.now(),
        };

        this.queue.push(queuedRequest);
        this.saveQueue();
    }

    remove(id: string) {
        this.queue = this.queue.filter((req) => req.id !== id);
        this.saveQueue();
    }

    async processQueue() {
        if (!navigator.onLine || this.queue.length === 0) return;

        const requests = [...this.queue];

        for (const request of requests) {
            try {
                await fetch(request.url, {
                    method: request.method,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: request.body ? JSON.stringify(request.body) : undefined,
                });

                this.remove(request.id);
            } catch (error) {
                console.error('Failed to process queued request:', error);
            }
        }
    }

    private monitorOnline() {
        if (typeof window === 'undefined') return;

        window.addEventListener('online', () => {
            this.processQueue();
        });
    }

    getQueueSize() {
        return this.queue.length;
    }
}

export const requestQueue = new RequestQueue();
