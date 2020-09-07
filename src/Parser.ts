import { Lex, StreamLex, Token } from "./Lex";
import { Rule, TerminalRule, DelayRule, EndRule } from "./Rule";
import { EventEmmiter } from "./utils/EventEmmiter";
import { List } from "./utils/List";
import { Matcher, MatchState, MatchResult } from "./Matcher";
import { Ast, TerminalAst, EndAst, DelayAst } from "./Ast";

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
    private rootWithEnd: Rule;
    private lex: Lex;
    private stack!: List<Matcher>;
    private astArr!: List<Ast>;

    private push(rule: Rule) {
        this.stack.push(rule.getMatcher());
    }

    constructor(private root: DelayRule<T>, rules: Rule[]) {
        this.rootWithEnd = root.and(new EndRule());
        this.push = this.push.bind(this);
        this.lex = new Lex(getTerminalRules(rules));
    }

    match(str: string, skipError = true): ParserResult<T> {
        let { ignore, errors } = this.reset(str);
        let errorAst: Ast[] = [];
        while (true) {
            let ast = this.astArr.shift()!;
            let res = this.machAst(ast);
            if (res.state === MatchState.success) {
                errorAst.push(...res.retry ?? []);
                return {
                    ast: res.ast[0] as InstanceType<T>,
                    ignoreAst: ignore,
                    errorAst,
                    errorToken: errors
                }
            }
            if (res.state === MatchState.fail) {
                let e = res.retry.pop();
                e && errorAst.push(e);
                if (skipError) {
                    let lastAst = res.retry.pop();
                    if (lastAst) {
                        res.retry.push(...lastAst.toTerminalAst());
                    }
                    this.retry(res.retry);
                    this.stack.push(this.rootWithEnd.getMatcher());
                    continue;
                }

                return {
                    ast: undefined,
                    ignoreAst: ignore,
                    errorAst,
                    errorToken: errors
                }
            }
        }
    }

    private machAst(ast: Ast): MatchResult {
        let res = this.stack.last!.match(ast, this.push);
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
                    throw new Error();
            }
        }
        return res;
    }

    private retry(ast?: Ast[]) {
        this.astArr.unshift(...ast ?? []);
    }

    private reset(str: string) {
        let { ast, errors, ignore } = this.lex.match(str);

        this.astArr = List.from<Ast>(ast);
        this.astArr.push(new EndAst());

        this.stack = new List<Matcher>();
        this.stack.push(this.rootWithEnd.getMatcher());

        return { errors, ignore };
    }
}

export class StreamParser<T extends typeof DelayAst> extends EventEmmiter<{}> {
    private lex: StreamLex;

    constructor(root: DelayRule<T>, rules: Rule[]) {
        super();
        this.lex = new StreamLex(getTerminalRules(rules));
    }

    match(str: string) {

    }

    end() {

    }
}