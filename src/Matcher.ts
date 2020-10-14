import { Ast, TerminalAst, RepeatAst, MoreAst, OptionalAst, EndAst, ChildrenAst } from "./Ast";
import type { Rule, TerminalRule, DelayRule } from "./Rule";
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
}

/**
 * ```DelayRule```对应的匹配器
 */
export class DelayMatcher extends Matcher {
    /**
     * @param delayRule 对应的```DelayRule```
     * @param maybeLeftRecursion 此规则是否可能发生左递归
     */
    constructor(readonly delayRule: DelayRule<any>, private maybeLeftRecursion: boolean) {
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
            let ast = new this.delayRule.ast(res.ast);
            if (this.maybeLeftRecursion) {
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
        if (res.state === MatchState.fail && this.cache) {
            res.retry.shift();
            return {
                state: MatchState.success,
                ast: [this.cache],
                retry: res.retry,
            }
        }
        return res;
    }
}

/**
 * ```AndMatcher```和```OrMatcher```执行状态的枚举
 */
enum AndOrState {
    /**刚初始化 */
    init,
    /**正执行匹配器左侧 */
    left,
    /**正执行匹配器右侧 */
    right
}

/**
 * ```AndRule```对应的匹配器
 */
export class AndMatcher extends Matcher {
    /**
     * @param left 左侧规则
     * @param right 右侧规则
     */
    constructor(private left: Rule, private right: Rule) {
        super();
    }
    /**
     * 执行状态
     */
    private state = AndOrState.init;
    /**
     * 是否正在执行匹配器右侧
     */
    get isRight() {
        return this.state === AndOrState.right;
    }

    match(ast: Ast, push: PushFn): MatchResult {
        switch (this.state) {
            case AndOrState.init:
                push(this.left);
                this.state = AndOrState.left;
                break;
            case AndOrState.left:
                push(this.right);
                this.state = AndOrState.right;
                break
            default:
                throw new UnreachableError();
        }
        return {
            state: MatchState.continue,
            retry: [ast]
        }
    }

    /**
     * 左侧匹配结果
     */
    private leftAst!: Ast[];
    onChildrenResult(res: MatchResult): MatchResult {
        switch (this.state) {
            case AndOrState.left:
                if (res.state === MatchState.success) {
                    this.leftAst = res.ast;
                    return {
                        state: MatchState.continue,
                        retry: res.retry
                    }
                }
                return res;
            case AndOrState.right:
                if (res.state === MatchState.success) {
                    return {
                        ...res,
                        ast: this.leftAst.concat(res.ast)
                    }
                }
                if (res.state === MatchState.fail) {
                    return {
                        ...res,
                        retry: this.leftAst.concat(res.retry)
                    }
                }
                return res;
            default:
                throw new UnreachableError();
        }
    }
}

/**
 * ```OrRule```对应的匹配器
 */
export class OrMatcher extends Matcher {
    /**
     * @param left 左侧规则
     * @param right 右侧规则
     */
    constructor(private left: Rule, private right: Rule) {
        super();
    }
    /**
     * 执行状态
     */
    private state = AndOrState.init;
    match(ast: Ast, push: PushFn): MatchResult {
        switch (this.state) {
            case AndOrState.init:
                push(this.left);
                this.state = AndOrState.left;
                break;
            case AndOrState.left:
                push(this.right);
                this.state = AndOrState.right;
                break
            default:
                throw new UnreachableError();
        }
        return {
            state: MatchState.continue,
            retry: [ast]
        }
    }
    onChildrenResult(res: MatchResult): MatchResult {
        switch (this.state) {
            case AndOrState.left:
                if (res.state === MatchState.fail) {
                    return {
                        ...res,
                        state: MatchState.continue,
                    }
                }
                return res;
            case AndOrState.right:
                return res;
            default:
                throw new UnreachableError();
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
}

/**
 * ```RepeatRule```对应的匹配器
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
     * 已经匹配上的```Ast```的数组
     */
    private cache: Ast[] = [];
    onChildrenResult(res: MatchResult, push: PushFn): MatchResult {
        if (res.state === MatchState.fail) {
            if (this.cache.length) {
                return {
                    state: MatchState.success,
                    ast: [new MoreAst(this.cache)],
                    retry: res.retry
                }
            } else {
                return res;
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
}