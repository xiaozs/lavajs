/**
 * 不可能执行到的Error，弹出此Error，意味着lavats库有bug
 */
export class UnreachableError extends Error {
    constructor() {
        super("不可能执行到的Error，弹出此Error，意味着lavats库有bug");
        Object.setPrototypeOf(this, this.constructor.prototype);
    }
}

/**
 * 对正则表达式字符串中的元字符进行转义的方法
 * @param str 正则表达式字符串
 */
export function replaceSpecialChar(str: string): string {
    return str.replace(/([$^*()+{}\[\]|\\.?])/g, "\\$1");
}