import type { TerminalRule } from "./Rule";
import type { Token } from "./Lex";
import { UnreachableError } from "./utils/utils";

export abstract class Ast {
    abstract toTerminalAst(): TerminalAst[];
    abstract toJSON(): object;
}

export class EndAst extends Ast {
    toTerminalAst(): TerminalAst[] {
        throw new UnreachableError();
    }
    toJSON(): object {
        return {
            name: this.constructor.name
        }
    }
}

export class TerminalAst extends Ast {
    constructor(readonly token: Token, readonly rule: TerminalRule) {
        super();
    }
    toTerminalAst(): TerminalAst[] {
        return [this];
    }
    toJSON(): object {
        return {
            name: this.constructor.name,
            reg: this.rule.options.reg.toString(),
            token: this.token,
        }
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
                throw new UnreachableError();
            }
        }
        return res;
    }
    toJSON(): object {
        return {
            name: this.constructor.name,
            children: this.children
        }
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