/**
 * 事件名称和事件回调参数的类型元组的映射
 * 
 * @example
 * ```
 * {
 *  "eventName": [number, number]
 * }
 * ```
 */
export interface EventMap {
    [event: string]: any[]
}

/**
 * 回调函数的接口
 * 
 * A 为参数的类型元组
 */
export interface Callback<A extends any[]> {
    (...arg: A): void;
}

/**
 * 事件发射器类，通过对其进行继承使对象获得事件功能
 * 
 * M 为事件名称和事件回调参数的类型元组的映射
 */
export abstract class EventEmmiter<M extends EventMap> {
    /**
     * 对事件进行进行保存的map
     */
    private map = new Map<keyof M, Callback<M[keyof M]>[]>();
    /**
     * 绑定特定事件的方法
     * @param event 事件名称
     * @param cb 事件回调
     */
    on<E extends keyof M>(event: E, cb: Callback<M[E]>) {
        let callbackArr = this.map.get(event);
        if (!callbackArr) {
            callbackArr = [];
            this.map.set(event, callbackArr);
        }

        callbackArr.push(cb as Callback<M[keyof M]>);
    }
    /**
     * 清除所有事件的方法
     */
    off(): void;
    /**
     * 清除特定事件名称下的所有回调的方法
     * @param event 事件名称
     */
    off<E extends keyof M>(event: E): void;
    /**
     * 清除特定事件名称下的特定事件回调的方法
     * @param event 事件名称
     * @param cb 事件回调
     */
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

    /**
     * 触发特定事件，并给相关回调传递对应参数的方法
     * @param event 事件名称
     * @param args 事件回调的参数
     */
    protected trigger<E extends keyof M>(event: E, ...args: M[E]) {
        let callbackArr = this.map.get(event);
        if (!callbackArr) return;
        for (let cb of callbackArr) {
            cb(...args);
        }
    }

    /**
     * 触发特定事件，并给相关回调传递对应参数的方法
     * 
     * （使用了setTimeout异步调用事件回调）
     * @param event 事件名称
     * @param args 事件回调的参数
     */
    protected triggerAsync<E extends keyof M>(event: E, ...args: M[E]) {
        let callbackArr = this.map.get(event);
        if (!callbackArr) return;
        for (let cb of callbackArr) {
            setTimeout(() => {
                cb(...args);
            });
        }
    }
}