import { TerminalAst, DelayAst } from "./Ast";
import { replaceSpecialChar } from "./utils/utils";
import { Matcher, TerminalMatcher, DelayMatcher, AndMatcher, OrMatcher, RepeatMatcher, MoreMatcher, OptionalMatcher, EndMatcher } from "./Matcher";
import { Parser, StreamParser } from "./Parser";

export class RuleCollection {
    private rules: Rule[] = [];

    terminal(options: string | RegExp | TerminalOptions) {
        let res = Rule.terminal(options)
        this.rules.push(res);
        return res;
    }

    delay<T extends typeof DelayAst>(ast: T): DelayRule<T> {
        let res = Rule.delay(ast);
        this.rules.push(res);
        return res;
    }

    getParser<T extends typeof DelayAst>(root: DelayRule<T>): Parser<T> {
        let isIn = this.rules.includes(root);
        if (!isIn) throw new Error();
        return new Parser(root, this.rules);
    }

    getStreamParser<T extends typeof DelayAst>(root: DelayRule<T>): StreamParser<T> {
        let isIn = this.rules.includes(root);
        if (!isIn) throw new Error();
        return new StreamParser(root, this.rules);
    }
}

export abstract class Rule {
    static delay<T extends typeof DelayAst>(ast: T): DelayRule<T> {
        return new DelayRule(ast);
    }
    static terminal(options: string | RegExp | TerminalOptions): Rule {
        return new TerminalRule(options);
    }
    and(rule: Rule): Rule {
        return new AndRule(this, rule);
    }
    or(rule: Rule): Rule {
        return new OrRule(this, rule);
    }
    repeat(): Rule {
        return new RepeatRule(this);
    }
    more(): Rule {
        return new MoreRule(this);
    }
    optional(): Rule {
        return new OptionalRule(this);
    }

    abstract getMatcher(): Matcher;
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

export class EndRule extends Rule {
    getMatcher(): Matcher {
        return new EndMatcher();
    }
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

    getMatcher(): Matcher {
        return new TerminalMatcher(this);
    }
}

export class DelayRule<T extends typeof DelayAst> extends Rule {
    private _rule: Rule | undefined;
    get rule() {
        if (!this._rule) throw new Error();
        return this._rule;
    }
    constructor(readonly ast: T) {
        super();
    }
    define(rule: Rule) {
        if (this._rule) throw new Error();
        this._rule = rule;
    }
    getMatcher(): Matcher {
        if (!this._rule) throw new Error();
        return new DelayMatcher(this);
    }
}

class AndRule extends Rule {
    constructor(private left: Rule, private right: Rule) {
        super();
    }
    getMatcher(): Matcher {
        return new AndMatcher(this.left, this.right);
    }
}

class OrRule extends Rule {
    constructor(private left: Rule, private right: Rule) {
        super();
    }
    getMatcher(): Matcher {
        return new OrMatcher(this.left, this.right);
    }
}

class RepeatRule extends Rule {
    constructor(private rule: Rule) {
        super();
    }
    getMatcher(): Matcher {
        return new RepeatMatcher(this.rule);
    }
}

class MoreRule extends Rule {
    constructor(private rule: Rule) {
        super();
    }
    getMatcher(): Matcher {
        return new MoreMatcher(this.rule);
    }
}

export class OptionalRule extends Rule {
    constructor(private rule: Rule) {
        super();
    }
    getMatcher(): Matcher {
        return new OptionalMatcher(this.rule);
    }
}