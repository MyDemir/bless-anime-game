// src/utils/EventEmitter.ts

type EventCallback = (...args: any[]) => void;

export class EventEmitter {
    private events: Map<string, EventCallback[]>;

    constructor() {
        console.log("EventEmitter başlatılıyor");
        this.events = new Map();
    }

    on(event: string, callback: EventCallback): void {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event)!.push(callback);
    }

    emit(event: string, ...args: any[]): void {
        const callbacks = this.events.get(event);
        if (callbacks) {
            callbacks.forEach(callback => callback(...args));
        }
    }

    off(event: string, callback: EventCallback): void {
        const callbacks = this.events.get(event);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index !== -1) {
                callbacks.splice(index, 1);
            }
        }
    }
}
