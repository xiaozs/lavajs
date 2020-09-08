interface ListItem<T> {
    value: T;
    prev?: ListItem<T>;
    next?: ListItem<T>;
}

export class List<T>{
    private static arrayToListItem<T>(iterable: Iterable<T>) {
        let head: ListItem<T> | undefined;
        let tail: ListItem<T> | undefined;

        let i = 0;
        let current: ListItem<T> | undefined;
        for (let it of iterable) {
            if (i === 0) {
                current = { value: it };
                head = current;
            } else {
                let item = { prev: current, value: it };
                current!.next = item;
                current = item;
            }
            i++;
        }
        tail = current;

        return { head, tail, length: i };
    }
    static from<T>(iterable: Iterable<T>): List<T> {
        let res = new List<T>();
        let { head, tail, length } = this.arrayToListItem(iterable);
        res._head = head;
        res._tail = tail;
        res._length = length;
        return res;
    }

    private _head?: ListItem<T>;
    private _tail?: ListItem<T>;
    private _length = 0;

    push(...value: T[]) {
        let { head, tail, length } = List.arrayToListItem(value);
        if (length === 0) return;

        if (this._length) {
            this._tail!.next = head;
            head!.prev = this._tail;
            this._tail = tail;
        } else {
            this._head = head;
            this._tail = tail;
        }
        this._length += length;
    }

    unshift(...value: T[]) {
        let { head, tail, length } = List.arrayToListItem(value);
        if (length === 0) return;

        if (this._length) {
            this._head!.prev = tail;
            tail!.next = this._head;
            this._head = head;
        } else {
            this._head = head;
            this._tail = tail;
        }
        this._length += length;
    }

    pop(): T | undefined {
        if (this._length == 0) return;

        let res = this._tail!;

        if (this._length === 1) {
            this._head = this._tail = undefined;
        } else {
            this._tail = res.prev;
        }

        this._length--;
        return res.value;
    }

    shift(): T | undefined {
        if (this._length == 0) return;

        let res = this._head!;

        if (this._length === 1) {
            this._head = this._tail = undefined;
        } else {
            this._head = res.next;
        }

        this._length--;
        return res.value;
    }

    get length() {
        return this._length;
    }

    get first() {
        return this._head?.value;
    }

    get last() {
        return this._tail?.value;
    }

    toArray(): T[] {
        let res: T[] = [];
        let current: ListItem<T> | undefined = this._head;
        while (current) {
            res.push(current.value);
            current = current.next;
        }
        return res;
    }

    *getReverseIterator(): IterableIterator<T> {
        let current = this._tail;
        while (current) {
            yield current.value;
            current = current.prev;
        }
    }
}