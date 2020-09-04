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
    errorAst?: Ast[];
    errorToken: Token[];
}

export class Parser<T extends typeof DelayAst> {
    private root: Rule;
    private lex: Lex;
    private stack!: List<Matcher>;
    private astArr!: List<Ast>;

    private push(rule: Rule) {
        this.stack.push(rule.getMatcher());
    }

    constructor(root: DelayRule<T>, rules: Rule[]) {
        this.root = root.and(new EndRule());
        this.push = this.push.bind(this);
        this.lex = new Lex(getTerminalRules(rules));
    }

    match(str: string): ParserResult<T> {
        let { ignore, errors } = this.reset(str);
        while (true) {
            let ast = this.astArr.shift()!;
            let res = this.machAst(ast);
            if (res.state === MatchState.success) {
                return {
                    ast: res.ast[0] as InstanceType<T>,
                    ignoreAst: ignore,
                    errorAst: res.retry,
                    errorToken: errors
                }
            }
            if (res.state === MatchState.fail) {
                return {
                    ast: undefined,
                    ignoreAst: ignore,
                    errorAst: res.retry.concat(this.astArr.toArray()),
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
                    let retry = res.retry ?? [];
                    this.astArr.unshift(...retry);
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

    private reset(str: string) {
        let { ast, errors, ignore } = this.lex.match(str);

        this.astArr = List.from<Ast>(ast);
        this.astArr.push(new EndAst());

        this.stack = new List<Matcher>();
        this.stack.push(this.root.getMatcher());

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