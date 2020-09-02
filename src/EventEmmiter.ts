export interface EventMap {
    [event: string]: any[]
}

export interface Callback<A extends any[]> {
    (...arg: A): void;
}

export abstract class EventEmmiter<M extends EventMap> {
    private map = new Map<keyof M, Callback<M[keyof M]>[]>();
    on<E extends keyof M>(event: E, cb: Callback<M[E]>) {
        let callbackArr = this.map.get(event);
        if (!callbackArr) {
            callbackArr = [];
            this.map.set(event, callbackArr);
        }

        callbackArr.push(cb as Callback<M[keyof M]>);
    }
    off(): void;
    off<E extends keyof M>(event: E): void;
    off<E extends keyof M>(event: E, cb: Callback<M[E]>): void;
    off<E extends keyof M>(event?: E, cb?: Callback<M[E]>) {
        let length = arguments.length;

        if (length === 0) {
            this.map = new Map();
        }

        if (length === 1) {
            this.map.set(event!, []);
        }

        if (length === 2) {
            let callbackArr = this.map.get(event!);
            if (!callbackArr) return;

            let index = callbackArr.indexOf(cb as Callback<M[keyof M]>);
            if (index == -1) return;

            callbackArr.splice(index, 1);
        }
    }

    protected trigger<E extends keyof M>(event: E, ...args: M[E]) {
        let callbackArr = this.map.get(event);
        if (!callbackArr) return;
        for (let cb of callbackArr) {
            cb(...args);
        }
    }
}