/**
 * 链表中的项
 * 
 * T 为项的类型
 */
interface ListItem<T> {
    value: T;
    prev?: ListItem<T>;
    next?: ListItem<T>;
}

/**
 * 链表
 * 
 * T 为项的类型
 */
export class List<T>{
    /**
     * 迭代输入，生成```ListItem```链表的方法
     * @param iterable 可迭代对象
     */
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

    /**
     * 生成可迭代对象的链表的方法
     * @param iterable 可迭代对象
     */
    static from<T>(iterable: Iterable<T>): List<T> {
        let res = new List<T>();
        let { head, tail, length } = this.arrayToListItem(iterable);
        res._head = head;
        res._tail = tail;
        res._length = length;
        return res;
    }

    /**
     * 链表的头部项
     */
    private _head?: ListItem<T>;
    /**
     * 链表的尾部项
     */
    private _tail?: ListItem<T>;
    /**
     * 链表的长度
     */
    private _length = 0;

    /**
     * 从链表尾部插入值的方法
     * @param value 插入的值
     */
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

    /**
     * 从链表头部插入值的方法
     * @param value 插入的值
     */
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

    /**
     * 弹出链表尾部值的方法
     */
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

    /**
     * 弹出链表头部值的方法
     */
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

    /**
     * 链表的长度
     */
    get length() {
        return this._length;
    }

    /**
     * 链表的头部对象
     */
    get first() {
        return this._head?.value;
    }

    /**
     * 链表的尾部对象
     */
    get last() {
        return this._tail?.value;
    }

    /**
     * 将链表转化为数组的方法
     */
    toArray(): T[] {
        let res: T[] = [];
        let current: ListItem<T> | undefined = this._head;
        while (current) {
            res.push(current.value);
            current = current.next;
        }
        return res;
    }

    /**
     * 生成链表的反向迭代器的方法
     */
    *getReverseIterator(): IterableIterator<T> {
        let current = this._tail;
        while (current) {
            yield current.value;
            current = current.prev;
        }
    }
}