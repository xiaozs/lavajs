import { Ast, DelayAst, EndAst, MoreAst, OptionalAst, RepeatAst, TerminalAst } from "./Ast";
import type { DelayRule, Rule, TerminalRule } from "./Rule";
import { UnreachableError } from "./utils/utils";

/**
 * 描述所有匹配结果的接口
 */
export type MatchResult =
    | MatchFail
    | MatchSuccess
    | MatchContinue
    ;

/**
 * 所有匹配结果的枚举
 */
export enum MatchState {
    /**匹配失败 */
    fail,
    /**匹配成功 */
    success,
    /**继续匹配 */
    continue
}

/**
 * 描述匹配失败结果的接口
 */
export interface MatchFail {
    /**
     * 匹配结果的枚举
     */
    state: MatchState.fail;
    /**
     * 需要重新匹配的```Ast```
     */
    retry: Ast[];
}

/**
 * 描述匹配成功结果的接口
 */
export interface MatchSuccess {
    /**
     * 匹配结果的枚举
     */
    state: MatchState.success;
    /**
     * 匹配成功的```Ast```
     */
    ast: Ast[];
    /**
     * 需要重新匹配的```Ast```
     */
    retry?: Ast[];
}

/**
 * 描述继续匹配结果的接口
 */
export interface MatchContinue {
    /**
     * 匹配结果的枚举
     */
    state: MatchState.continue;
    /**
     * 需要重新匹配的```Ast```
     */
    retry?: Ast[]
}

/**
 * 描述往执行匹配栈中插入规则的方法的接口
 */
export interface PushFn {
    /**
     * @param rule 需要被插入的规则
     */
    (rule: Rule): void;
}

/**
 * 描述判断当前规则是否左递归的方法的接口
 */
export interface IsLeftRecursion {
    (): boolean;
}

/**
 * 匹配器的类
 */
export abstract class Matcher {
    /**
     * 对```Ast```进行匹配的方法
     * @param ast 要被匹配的```Ast```
     * @param push 往执行匹配栈中插入规则的方法
     * @param isLeftRecursion 判断当前规则是否左递归的方法
     */
    abstract match(ast: Ast, push: PushFn, isLeftRecursion: IsLeftRecursion): MatchResult;
    /**
     * 改写子规则结果或插入新子规则的方法
     * @param res 子规则的匹配结果
     * @param push 往执行匹配栈中插入规则的方法
     */
    abstract onChildrenResult(res: MatchResult, push: PushFn): MatchResult;
    /**
     * 方便使用```JSON.stringify```方法打印```Matcher```的规则的辅助方法
     */
    abstract toJSON(): object;
    /**
     * 规则转换成字符串
     */
    toString() {
        return JSON.stringify(this);
    }
}

/**
 * ```EndRule```对应的匹配器
 */
export class EndMatcher extends Matcher {
    match(ast: Ast): MatchResult {
        if (ast instanceof EndAst) {
            return {
                state: MatchState.success,
                ast: []
            }
        } else {
            return {
                state: MatchState.fail,
                retry: [ast]
            }
        }
    }
    onChildrenResult(res: MatchResult, push: PushFn): MatchResult {
        throw new UnreachableError();
    }
    toJSON(): object {
        return {
            name: "$end"
        }
    }
}

/**
 * ```TerminalRule```对应的匹配器
 */
export class TerminalMatcher extends Matcher {
    /**
     * @param rule 对应的```TerminalRule```
     */
    constructor(private rule: TerminalRule) {
        super();
    }
    match(ast: Ast): MatchResult {
        // if (ast instanceof ChildrenAst) {
        //     return {
        //         state: MatchState.continue,
        //         retry: ast.children
        //     }
        // }

        if (ast instanceof TerminalAst && ast.rule === this.rule) {
            return {
                state: MatchState.success,
                ast: [ast]
            }
        } else {
            return {
                state: MatchState.fail,
                retry: [ast]
            }
        }
    }
    onChildrenResult(res: MatchResult): MatchResult {
        throw new UnreachableError();
    }
    toJSON(): object {
        return this.rule.toJSON();
    }
}

/**
 * ```DelayRule```对应的匹配器
 */
export class DelayMatcher<A extends Ast[], R extends DelayAst<A>> extends Matcher {
    /**
     * @param delayRule 对应的```DelayRule```
     * @param maybeLeftRecursion 此规则是否可能发生左递归
     */
    constructor(readonly delayRule: DelayRule<A, R>, private maybeLeftRecursion: boolean) {
        super();
    }
    match(ast: Ast, push: PushFn, isLeftRecursion: IsLeftRecursion): MatchResult {
        if (ast instanceof this.delayRule.ast) {
            return {
                state: MatchState.success,
                ast: [ast]
            }
        }

        if (this.maybeLeftRecursion && isLeftRecursion()) {
            return {
                state: MatchState.fail,
                retry: [ast]
            }
        }

        push(this.delayRule.rule);
        return {
            state: MatchState.continue,
            retry: [ast]
        }
    }

    /**
     * 用于消除左递归的一个关键```Ast```缓存
     */
    private cache?: Ast;
    onChildrenResult(res: MatchResult, push: PushFn): MatchResult {
        if (res.state === MatchState.success) {
            let ast = new this.delayRule.ast(res.ast as A);
            if (this.maybeLeftRecursion &&
                !(res.ast[0] instanceof MoreAst)
                // todo, repeat 和 optional 呢？
            ) {
                // 如果该规则可能左递归
                // 则该规则可能通过自身类型的Ast重入
                // 以匹配该规则下的递归分支的规则
                // 这里的代码是为了重入尝试匹配该分支的
                this.cache = ast;
                push(this.delayRule.rule);
                return {
                    state: MatchState.continue,
                    retry: [ast, ...res.retry ?? []]
                }
            } else {
                return {
                    ...res,
                    ast: [ast]
                }
            }
        }

        // 通过判断this.cache是否存在，
        // 来判断是否是重入的
        if (res.state === MatchState.fail && this.cache) {
            // 返回重入前的结果
            res.retry.shift();
            return {
                state: MatchState.success,
                ast: [this.cache],
                retry: res.retry,
            }
        }
        return res;
    }
    toJSON(): object {
        return this.delayRule.toJSON();
    }
}

/**
 * ```AndRule```对应的匹配器
 */
export class AndMatcher extends Matcher {
    /**
     * @param rules 规则集
     */
    constructor(private rules: readonly Rule[]) {
        super();
    }
    /**
     * 执行状态
     */
    private state = -1;
    match(ast: Ast, push: PushFn): MatchResult {
        let currentRule = this.rules[++this.state];
        if (!currentRule) throw new UnreachableError();
        push(currentRule);
        return {
            state: MatchState.continue,
            retry: [ast]
        }
    }

    /**
     * 是否不在匹配第一个规则
     */
    get isNotMatchingFirstRule() {
        return this.state !== 0;
    }

    /**
     * 已经匹配结果
     */
    private resAst: Ast[] = [];
    onChildrenResult(res: MatchResult): MatchResult {
        if (res.state === MatchState.success) {
            let isEnd = this.state === this.rules.length - 1;
            if (isEnd) {
                return {
                    ...res,
                    ast: this.resAst.concat(res.ast)
                }
            } else {
                this.resAst.push(...res.ast);
                return {
                    state: MatchState.continue,
                    retry: res.retry
                }
            }
        }
        if (res.state === MatchState.fail) {
            return {
                ...res,
                retry: this.resAst.concat(res.retry)
            }
        }
        return res;
    }
    toJSON(): object {
        return {
            name: "$and",
            rule: this.rules
        }
    }
}

/**
 * ```OrRule```对应的匹配器
 */
export class OrMatcher extends Matcher {
    /**
     * @param rules 规则集
     */
    constructor(private rules: readonly Rule[]) {
        super();
    }
    /**
     * 执行状态
     */
    private state = -1;
    match(ast: Ast, push: PushFn): MatchResult {
        let currentRule = this.rules[++this.state];
        if (!currentRule) throw new UnreachableError();
        push(currentRule);
        return {
            state: MatchState.continue,
            retry: [ast]
        }
    }
    onChildrenResult(res: MatchResult): MatchResult {
        let isEnd = this.state === this.rules.length - 1;
        if (isEnd) {
            return res;
        } else {
            if (res.state === MatchState.fail) {
                return {
                    ...res,
                    state: MatchState.continue,
                }
            }
            return res;
        }
    }
    toJSON(): object {
        return {
            name: "$or",
            rule: this.rules
        }
    }
}

/**
 * ```RepeatRule```对应的匹配器
 * 
 * 相当于```*```
 */
export class RepeatMatcher extends Matcher {
    /**
     * @param rule 被重复的```Rule```
     */
    constructor(private rule: Rule) {
        super();
    }
    match(ast: Ast, push: PushFn): MatchResult {
        push(this.rule);
        return {
            state: MatchState.continue,
            retry: [ast]
        }
    }

    /**
     * 是否不在匹配第一次
     */
    get isNotMatchingFirstTime() {
        return !!this.cache.length;
    }

    /**
     * 已经匹配上的```Ast```的数组
     */
    private cache: Ast[] = [];
    onChildrenResult(res: MatchResult, push: PushFn): MatchResult {
        if (res.state === MatchState.fail) {
            return {
                state: MatchState.success,
                ast: [new RepeatAst(this.cache)],
                retry: res.retry
            }
        }
        if (res.state === MatchState.success) {
            this.cache.push(...res.ast);
            push(this.rule);
            return {
                state: MatchState.continue,
                retry: res.retry
            }
        }
        return res;
    }
    toJSON(): object {
        return {
            name: "$repeat",
            rule: this.rule
        }
    }
}

/**
 * ```MoreRule```对应的匹配器
 * 
 * 相当于```+```
 */
export class MoreMatcher extends Matcher {
    /**
     * @param rule 被重复的```Rule```
     */
    constructor(private rule: Rule) {
        super();
    }
    match(ast: Ast, push: PushFn): MatchResult {
        push(this.rule);
        return {
            state: MatchState.continue,
            retry: [ast]
        }
    }

    /**
     * 是否不在匹配第一次
     */
    get isNotMatchingFirstTime() {
        return !!this.cache.length;
    }

    /**
     * 已经匹配上的```Ast```的数组
     */
    private cache: Ast[] = [];
    onChildrenResult(res: MatchResult, push: PushFn): MatchResult {
        if (res.state === MatchState.fail) {
            if ([0, 1].includes(this.cache.length)) {
                return {
                    ...res,
                    retry: [...this.cache, ...res.retry]
                }
            }
            return {
                state: MatchState.success,
                ast: [new MoreAst(this.cache)],
                retry: res.retry
            }
        }
        if (res.state === MatchState.success) {
            this.cache.push(...res.ast);
            push(this.rule);
            return {
                state: MatchState.continue,
                retry: res.retry
            }
        }
        return res;
    }
    toJSON(): object {
        return {
            name: "$more",
            rule: this.rule
        }
    }
}

/**
 * ```RepeatRule```对应的匹配器
 * 
 * 相当于```?```
 */
export class OptionalMatcher extends Matcher {
    /**
     * @param rule 可选的```Rule```
     */
    constructor(private rule: Rule) {
        super();
    }
    match(ast: Ast, push: PushFn): MatchResult {
        push(this.rule);
        return {
            state: MatchState.continue,
            retry: [ast]
        }
    }
    onChildrenResult(res: MatchResult): MatchResult {
        if (res.state === MatchState.fail) {
            return {
                state: MatchState.success,
                ast: [new OptionalAst([])],
                retry: res.retry
            }
        }
        if (res.state === MatchState.success) {
            return {
                ...res,
                ast: [new OptionalAst(res.ast)]
            }
        }
        return res;
    }
    toJSON(): object {
        return {
            name: "$more",
            rule: this.rule
        }
    }
}