export class EventBus {
    handlers = new Map();
    subscribe(event, handler) {
        if (!this.handlers.has(event)) {
            this.handlers.set(event, new Set());
        }
        this.handlers.get(event).add(handler);
        return () => {
            this.handlers.get(event)?.delete(handler);
        };
    }
    once(event, handler) {
        const wrapper = (payload) => {
            this.handlers.get(event)?.delete(wrapper);
            handler(payload);
        };
        if (!this.handlers.has(event)) {
            this.handlers.set(event, new Set());
        }
        this.handlers.get(event).add(wrapper);
    }
    emit(event, payload) {
        const handlers = this.handlers.get(event);
        if (!handlers)
            return;
        for (const handler of handlers) {
            handler(payload);
        }
    }
    clear(event) {
        if (event) {
            this.handlers.delete(event);
        }
        else {
            this.handlers.clear();
        }
    }
}
//# sourceMappingURL=EventBus.js.map