export class UnreachableError extends Error {
    constructor() {
        super();
        Object.setPrototypeOf(this, this.constructor.prototype);
    }
}

export function replaceSpecialChar(str: string): string {
    return str.replace(/([$^*()+{}\[\]|\\.?])/g, "\\$1");
}