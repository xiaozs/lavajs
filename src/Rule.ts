import { TerminalAst } from "./Ast";
import { replaceSpecialChar } from "./utils";


export class Rule {

}

export interface TerminalOptions {
    reg: RegExp | string;
    ignore?: boolean;
    ast?: typeof TerminalAst;
}

interface InnerTerminalOptions {
    reg: RegExp;
    ignore: boolean;
    ast: typeof TerminalAst;
}

export class TerminalRule extends Rule {
    readonly options: InnerTerminalOptions;

    constructor(options: TerminalOptions | RegExp | string) {
        super();

        let opt: TerminalOptions;
        if (typeof options === "string") {
            opt = { reg: this.stringToReg(options) };
        } else if (options instanceof RegExp) {
            opt = { reg: options };
        } else {
            opt = Object.assign({}, options, {
                reg: typeof options.reg === "string" ? this.stringToReg(options.reg) : options.reg
            })
        }

        this.options = Object.assign({ ignore: false, ast: TerminalAst }, opt) as InnerTerminalOptions;
    }

    private stringToReg(str: string): RegExp {
        str = replaceSpecialChar(str);
        return new RegExp(str);
    }
}