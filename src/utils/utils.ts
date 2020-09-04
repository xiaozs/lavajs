

export function replaceSpecialChar(str: string): string {
    return str.replace(/([$^*()+{}\[\]|\\.?])/g, "\\$1");
}