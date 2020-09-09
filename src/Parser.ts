import { StreamLex, Token } from "./Lex";
import { Rule, TerminalRule, DelayRule, EndRule } from "./Rule";
import { EventEmmiter } from "./utils/EventEmmiter";
import { List } from "./utils/List";
import { Matcher, MatchState, MatchResult, DelayMatcher, AndMatcher } from "./Matcher";
import { Ast, TerminalAst, EndAst, DelayAst } from "./Ast";
import { UnreachableError } from "./utils/utils";

function getTerminalRules(rules: Rule[]): TerminalRule[] {
    return rules.filter(it => it instanceof TerminalRule) as TerminalRule[];
}

export interface ParserResult<T extends typeof DelayAst> {
    ast?: InstanceType<T>;
    ignoreAst: TerminalAst[];
    errorAst: Ast[];
    errorToken: Token[];
}

export class Parser<T extends typeof DelayAst> {
    private streamParser: StreamParser<T>;
    constructor(root: DelayRule<T>, rules: Rule[]) {
        this.streamParser = new StreamParser(root, rules);
    }

    match(str: string, skipError = true): ParserResult<T> {
        let res!: ParserResult<T>;

        function getRes(r: ParserResult<T>) {
            res = r;
        }

        this.streamParser.reset(skipError);
        this.streamParser.on("end", getRes);
        this.streamParser.match(str);
        this.streamParser.end();
        this.streamParser.off("end", getRes);

        return res;
    }
}

export class StreamParser<T extends typeof DelayAst>
    extends EventEmmiter<{
        error: [ParserResult<T>],
        ignore: [ParserResult<T>],
        end: [ParserResult<T>],

        success: [ParserResult<T>],
        fail: [ParserResult<T>],
    }> {
    private root: Rule;
    private lex: StreamLex;
    private stack!: List<Matcher>;
    private astArr!: List<Ast>;
    private res!: ParserResult<T>;

    private push(rule: Rule) {
        this.stack.push(rule.getMatcher());
    }

    private isLeftRecursion(): boolean {
        let iterator = this.stack.getReverseIterator();
        let last = iterator.next().value as DelayMatcher;
        for (let it of iterator) {
            let isSameRule = it instanceof DelayMatcher && it.delayRule === last.delayRule;
            if (isSameRule) return true;

            let isAndRight = it instanceof AndMatcher && it.isRight;
            if (isAndRight) return false;
        }
        return false;
    }

    constructor(root: DelayRule<T>, rules: Rule[], private skipError = true) {
        super();
        this.push = this.push.bind(this);
        this.isLeftRecursion = this.isLeftRecursion.bind(this);

        this.root = root.and(new EndRule());

        this.onError = this.onError.bind(this);
        this.onAst = this.onAst.bind(this);
        this.onIgnore = this.onIgnore.bind(this);
        this.onEnd = this.onEnd.bind(this);

        this.lex = new StreamLex(getTerminalRules(rules));
        this.lex.on("error", this.onError);
        this.lex.on("ast", this.onAst);
        this.lex.on("ignore", this.onIgnore);
        this.lex.on("end", this.onEnd);

        this.reset();
    }

    private onError(token: Token) {
        this.res.errorToken.push(token);
        this.trigger("error", this.res);
    }
    private onIgnore(ast: TerminalAst) {
        this.res.ignoreAst.push(ast);
        this.trigger("ignore", this.res);
    }
    private onEnd() {
        this.onAst(new EndAst());
        this.trigger("end", this.res)
    }

    private onAst(ast: Ast) {
        this.astArr.push(ast);
        while (true) {
            let currentAst = this.astArr.shift();
            if (!currentAst) break;

            let res = this.machAst(currentAst);
            if (res.state === MatchState.success) {
                this.res.ast = res.ast[0] as InstanceType<T>;
                this.res.errorAst.push(...res.retry ?? []);
                return this.trigger("success", this.res);
            }
            if (res.state === MatchState.fail) {
                let e = res.retry.pop();
                e && this.res.errorAst.push(e);
                if (this.skipError) {
                    let lastAst = res.retry.pop();
                    if (lastAst) {
                        res.retry.push(...lastAst.toTerminalAst());
                    }
                    this.retry(res.retry);
                    this.stack.push(this.root.getMatcher());
                    continue;
                }

                return this.trigger("fail", this.res);
            }
        }
    }

    private machAst(ast: Ast): MatchResult {
        let res = this.stack.last!.match(ast, this.push, this.isLeftRecursion);
        loop: while (true) {
            switch (res.state) {
                case MatchState.continue:
                    this.retry(res.retry);
                    break loop;
                case MatchState.success:
                case MatchState.fail:
                    this.stack.pop();
                    if (this.stack.last) {
                        res = this.stack.last.onChildrenResult(res, this.push);
                        continue loop;
                    } else {
                        break loop;
                    }
                default:
                    throw new UnreachableError();
            }
        }
        return res;
    }

    private retry(ast?: Ast[]) {
        this.astArr.unshift(...ast ?? []);
    }

    reset(skipError?: boolean) {
        this.skipError = skipError ?? this.skipError;
        this.lex.reset();
        this.astArr = new List();
        this.stack = new List();
        this.stack.push(this.root.getMatcher());
        this.res = {
            ast: undefined,
            ignoreAst: [],
            errorAst: [],
            errorToken: [],
        };
    }

    match(str: string) {
        this.lex.match(str);
    }

    end() {
        this.lex.end();
    }
}