import { TerminalAst, DelayAst } from "./Ast";
import { replaceSpecialChar } from "./utils/utils";
import { Matcher, TerminalMatcher, DelayMatcher, AndMatcher, OrMatcher, RepeatMatcher, MoreMatcher, OptionalMatcher, EndMatcher } from "./Matcher";
import { Parser, StreamParser } from "./Parser";

export class RuleNotDefinedError extends Error { }
export class RuleNotInCollectionError extends Error { }

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
        if (!isIn) throw new RuleNotInCollectionError();
        return new Parser(root, this.rules);
    }

    getStreamParser<T extends typeof DelayAst>(root: DelayRule<T>): StreamParser<T> {
        let isIn = this.rules.includes(root);
        if (!isIn) throw new RuleNotInCollectionError();
        return new StreamParser(root, this.rules);
    }

    toJSON(): object {
        return {
            rules: this.rules.map(it => it.toJSON())
        };
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
    abstract toJSON(): object;
    abstract maybeLeftRecursion(rule: DelayRule<any>): boolean;
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
    toJSON(): object {
        return {
            name: "$end"
        }
    }
    maybeLeftRecursion(rule: DelayRule<any>): boolean {
        return false;
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
    toJSON(): object {
        return {
            name: this.options.ast.name,
            reg: this.options.reg.toString(),
            ignore: this.options.ignore
        }
    }
    maybeLeftRecursion(rule: DelayRule<any>): boolean {
        return false;
    }
}

export class DelayRule<T extends typeof DelayAst> extends Rule {
    private _rule: Rule | undefined;
    get rule() {
        if (!this._rule) throw new RuleNotDefinedError();
        return this._rule;
    }
    constructor(readonly ast: T) {
        super();
    }
    define(rule: Rule) {
        if (this._rule) throw new RuleNotDefinedError();
        this._rule = rule;
    }

    private cache?: boolean;
    getMatcher(): Matcher {
        if (!this._rule) throw new RuleNotDefinedError();
        this.cache = this.cache ?? this.maybeLeftRecursion(this);
        return new DelayMatcher(this, this.cache);
    }
    toJSON(key?: string): object {
        return {
            name: this.ast.name,
            rule: key ? undefined : this.rule
        }
    }
    maybeLeftRecursion(rule: DelayRule<any>): boolean {
        if (rule === this) return true;
        return this.rule.maybeLeftRecursion(rule);
    }
}

class AndRule extends Rule {
    constructor(private left: Rule, private right: Rule) {
        super();
    }
    getMatcher(): Matcher {
        return new AndMatcher(this.left, this.right);
    }

    private getAnd() {
        let res: Rule[] = [];
        for (let it of [this.left, this.right]) {
            if (it instanceof AndRule) {
                res.push(...it.getAnd());
            } else {
                res.push(it);
            }
        }
        return res;
    }

    toJSON(): object {
        return {
            name: "$and",
            rule: this.getAnd()
        }
    }
    maybeLeftRecursion(rule: DelayRule<any>): boolean {
        return this.left.maybeLeftRecursion(rule);
    }
}

class OrRule extends Rule {
    constructor(private left: Rule, private right: Rule) {
        super();
    }
    getMatcher(): Matcher {
        return new OrMatcher(this.left, this.right);
    }

    private getOr() {
        let res: Rule[] = [];
        for (let it of [this.left, this.right]) {
            if (it instanceof OrRule) {
                res.push(...it.getOr());
            } else {
                res.push(it);
            }
        }
        return res;
    }

    toJSON(): object {
        return {
            name: "$or",
            rule: this.getOr()
        }
    }
    maybeLeftRecursion(rule: DelayRule<any>): boolean {
        return this.left.maybeLeftRecursion(rule);
    }
}

class RepeatRule extends Rule {
    constructor(private rule: Rule) {
        super();
    }
    getMatcher(): Matcher {
        return new RepeatMatcher(this.rule);
    }
    toJSON(): object {
        return {
            name: "$repeat",
            rule: this.rule
        }
    }
    maybeLeftRecursion(rule: DelayRule<any>): boolean {
        return this.rule.maybeLeftRecursion(rule);
    }
}

class MoreRule extends Rule {
    constructor(private rule: Rule) {
        super();
    }
    getMatcher(): Matcher {
        return new MoreMatcher(this.rule);
    }
    toJSON(): object {
        return {
            name: "$more",
            rule: this.rule
        }
    }
    maybeLeftRecursion(rule: DelayRule<any>): boolean {
        return this.rule.maybeLeftRecursion(rule);
    }
}

class OptionalRule extends Rule {
    constructor(private rule: Rule) {
        super();
    }
    getMatcher(): Matcher {
        return new OptionalMatcher(this.rule);
    }
    toJSON(): object {
        return {
            name: "$optional",
            rule: this.rule
        }
    }
    maybeLeftRecursion(rule: DelayRule<any>): boolean {
        return this.rule.maybeLeftRecursion(rule);
    }
}