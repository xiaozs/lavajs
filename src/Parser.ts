import { StreamLex, Token } from "./Lex";
import { Rule, TerminalRule, DelayRule, EndRule } from "./Rule";
import { EventEmmiter } from "./utils/EventEmmiter";
import { List } from "./utils/List";
import { Matcher, MatchState, MatchResult, DelayMatcher, AndMatcher } from "./Matcher";
import { Ast, TerminalAst, EndAst, DelayAst } from "./Ast";
import { UnreachableError } from "./utils/utils";

/**
 * 从规则数组中过滤出```TerminalRule```的方法
 * @param rules 规则的数组
 */
function getTerminalRules(rules: Rule[]): TerminalRule[] {
    return rules.filter(it => it instanceof TerminalRule) as TerminalRule[];
}

/**
 * 描述语法分析器匹配结果的接口
 */
export interface ParserResult<T extends typeof DelayAst> {
    /**
     * 生成的```Ast```树，可通过判断是否为undefined，来判断是否成功
     */
    ast?: InstanceType<T>;
    /**
     * 词法分析中被跳过的```Ast```的数组
     */
    ignoreAst: TerminalAst[];
    /**
     * 不符合语法的```Ast```的数组
     */
    errorAst: Ast[];
    /**
     * 不符合词法的```Token```的数组
     */
    errorToken: Token[];
}

/**
 * 语法分析器的类
 */
export class Parser<T extends typeof DelayAst> {
    /**
     * 同步的语法分析器由流式的语法分析器```StreamParser```组合实现
     */
    private streamParser: StreamParser<T>;
    /**
     * @param root 根规则
     * @param rules 所有规则
     */
    constructor(root: DelayRule<T>, rules: Rule[]) {
        this.streamParser = new StreamParser(root, rules);
    }

    /**
     * 对字符串进行语法分析的方法
     * @param str 待分析字符
     * @param skipError 当遇到不符合语法规则的```Ast```时，是否将其忽略，继续进行匹配（默认为```true```）
     */
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

/**
 * 语法分析器的类
 * 
 * （接受流式数据，以事件形式返回结果）
 * @event error     发生词法错误时候触发的事件
 * @event ignore    分析出被忽略```Ast```时触发的事件
 * @event end       语法分析结束时触发的事件
 * @event success   语法分析成功时触发的事件
 * @event fail      语法分析失败时触发的事件
 */
export class StreamParser<T extends typeof DelayAst>
    extends EventEmmiter<{
        error: [ParserResult<T>],
        ignore: [ParserResult<T>],
        end: [ParserResult<T>],

        success: [ParserResult<T>],
        fail: [ParserResult<T>],
    }> {
    /**
     * 根规则
     */
    private root: Rule;
    /**
     * 流式词法分析器
     */
    private lex: StreamLex;
    /**
     * 规则匹配栈
     */
    private stack!: List<Matcher>;
    /**
     * 待匹配的```Ast```
     */
    private astArr!: List<Ast>;
    /**
     * 匹配结果
     */
    private res!: ParserResult<T>;

    /**
     * 往规则栈中插入规则的辅助方法
     * @param rule 规则
     */
    private push(rule: Rule) {
        this.stack.push(rule.getMatcher());
    }

    /**
     * 判断当前规则是否左递归的方法
     */
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

    /**
     * @param root 根规则
     * @param rules 所有规则
     * @param skipError 当遇到不符合语法规则的```Ast```时，是否将其忽略，继续进行匹配（默认为```true```）
     */
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

    /**
     * 词法分析器触发```error```事件时的回调
     * @param token 不符合词法规则的```Token```
     */
    private onError(token: Token) {
        this.res.errorToken.push(token);
        this.trigger("error", this.res);
    }
    /**
     * 词法分析器触发```ignore```事件时的回调
     * @param ast 被忽略的```Ast```
     */
    private onIgnore(ast: TerminalAst) {
        this.res.ignoreAst.push(ast);
        this.trigger("ignore", this.res);
    }
    /**
     * 词法分析器触发```end```事件时的回调
     */
    private onEnd() {
        this.onAst(new EndAst());
        this.trigger("end", this.res)
    }

    /**
     * 词法分析器触发```ast```事件时的回调，
     * 是语法分析器的核心方法
     * @param ast 词法分析器分析到的```TerminalAst```
     */
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

    /**
     * 对```Ast```进行匹配的方法，
     * 是语法分析器的核心方法
     * @param ast 被匹配的```Ast```
     */
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

    /**
     * 对```Ast```进行重新匹配的方法
     * @param ast 需要重新匹配的```Ast```的数组
     */
    private retry(ast?: Ast[]) {
        this.astArr.unshift(...ast ?? []);
    }

    /**
     * 重置当前语法分析器的方法
     * @param skipError 当遇到不符合语法规则的```Ast```时，是否将其忽略，继续进行匹配（默认为原有值）
     */
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

    /**
     * 输入进行语法分析的字符的方法
     * @param str 待匹配的字符
     */
    match(str: string) {
        this.lex.match(str);
    }

    /**
     * 提示语法分析器已经输入了所有待处理字符的方法
     */
    end() {
        this.lex.end();
    }
}