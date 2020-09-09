export class UnreachableError extends Error { }

export function replaceSpecialChar(str: string): string {
    return str.replace(/([$^*()+{}\[\]|\\.?])/g, "\\$1");
}