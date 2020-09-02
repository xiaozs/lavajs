import { TerminalRule } from "./Rule";
import { Token } from "./PositionLogger";


export abstract class Ast {

}

export class TerminalAst extends Ast {
    constructor(readonly token: Token, readonly rule: TerminalRule) {
        super();
    }
}