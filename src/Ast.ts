import type { TerminalRule } from "./Rule";
import type { Token } from "./Lex";

export abstract class Ast {
}

export class EndAst extends Ast {
}

export class TerminalAst extends Ast {
    constructor(readonly token: Token, readonly rule: TerminalRule) {
        super();
    }
    toTerminalAst(): TerminalAst[] {
        return [this];
    }
}

export abstract class ChildrenAst extends Ast {
    constructor(public children: Ast[]) {
        super();
    }
    toTerminalAst(): TerminalAst[] {
        let res: TerminalAst[] = [];
        for (let it of this.children) {
            if (it instanceof TerminalAst) {
                res.push(it);
            } else if (it instanceof ChildrenAst) {
                let terminals = it.toTerminalAst();
                res.push(...terminals);
            } else {
                throw new Error();
            }
        }
        return res;
    }
}

export class DelayAst extends ChildrenAst {
}

export class RepeatAst extends ChildrenAst {
}

export class MoreAst extends ChildrenAst {
}

export class OptionalAst extends ChildrenAst {
}