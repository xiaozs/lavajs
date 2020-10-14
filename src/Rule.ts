import { TerminalAst, DelayAst } from "./Ast";
import { replaceSpecialChar } from "./utils/utils";
import { Matcher, TerminalMatcher, DelayMatcher, AndMatcher, OrMatcher, RepeatMatcher, MoreMatcher, OptionalMatcher, EndMatcher } from "./Matcher";
import { Parser, StreamParser } from "./Parser";

/**
 * ```DelayRule```规则没有定义的异常
 */
export class RuleNotDefinedError extends Error {
    constructor() {
        super();
        Object.setPrototypeOf(this, this.constructor.prototype);
    }
}

/**
 * 根规则不在```RuleCollection```中的异常
 */
export class RuleNotInCollectionError extends Error {
    constructor() {
        super();
        Object.setPrototypeOf(this, this.constructor.prototype);
    }
}

/**
 * 规则集的类
 */
export class RuleCollection {
    /**
     * 所有规则的数组
     */
    private rules: Rule[] = [];

    /**
     * 生成```TerminalRule```，并在当前规则集```RuleCollection```中添加该规则的方法，
     * @param options ```TerminalRule```的配置
     */
    terminal(options: string | RegExp | TerminalOptions) {
        let res = Rule.terminal(options)
        this.rules.push(res);
        return res;
    }

    /**
     * 生成```DelayRule```，并在当前规则集```RuleCollection```中添加该规则的方法，
     * @param ast 自定义生成```Ast```的类
     */
    delay<T extends typeof DelayAst>(ast: T): DelayRule<T> {
        let res = Rule.delay(ast);
        this.rules.push(res);
        return res;
    }

    /**
     * 生成语法分析器
     * @param root 指定作为根对象的规则
     */
    getParser<T extends typeof DelayAst>(root: DelayRule<T>): Parser<T> {
        let isIn = this.rules.includes(root);
        if (!isIn) throw new RuleNotInCollectionError();
        return new Parser(root, this.rules);
    }

    /**
     * 生成语法分析器
     * （接受流式数据，以事件形式返回结果）
     * @param root 指定作为根对象的规则
     */
    getStreamParser<T extends typeof DelayAst>(root: DelayRule<T>): StreamParser<T> {
        let isIn = this.rules.includes(root);
        if (!isIn) throw new RuleNotInCollectionError();
        return new StreamParser(root, this.rules);
    }

    /**
     * 方便使用```JSON.stringify```方法打印```Rule```的规则描述的辅助方法
     * 
     * （应通过调用```JSON.stringify```来使用，不应该直接调用）
     */
    toJSON(): object {
        return {
            rules: this.rules.map(it => it.toJSON())
        };
    }
}

/**
 * 规则的类
 */
export abstract class Rule {
    /**
     * 生成```DelayRule```
     * @param ast 自定义生成```Ast```的类
     */
    static delay<T extends typeof DelayAst>(ast: T): DelayRule<T> {
        return new DelayRule(ast);
    }
    /**
     * 生成```TerminalRule```
     * @param options ```TerminalRule```的配置
     */
    static terminal(options: string | RegExp | TerminalOptions): Rule {
        return new TerminalRule(options);
    }
    /**
     * 生成一个新规则的方法，新规则需先满足原规则，再满足另一个规则
     * @param rule 另一个规则
     */
    and(rule: Rule): Rule {
        return new AndRule(this, rule);
    }
    /**
     * 生成一个新规则的方法，新规则需满足原规则，或满足另一个规则
     * @param rule 另一规则
     */
    or(rule: Rule): Rule {
        return new OrRule(this, rule);
    }
    /**
     * 生成一个新规则的方法，新规则需满足原规则0到多次
     * 
     * 相当于```*```
     */
    repeat(): Rule {
        return new RepeatRule(this);
    }
    /**
     * 生成一个新规则的方法，新规则需满足原规则1到多次
     * 
     * 相当于```+```
     */
    more(): Rule {
        return new MoreRule(this);
    }
    /**
     * 生成一个新规则的方法，新规则需满足原规则0或1次
     * 
     * 相当于```?```
     */
    optional(): Rule {
        return new OptionalRule(this);
    }

    /**
     * 生成规则对应的匹配器
     */
    abstract getMatcher(): Matcher;
    /**
     * 方便使用```JSON.stringify```方法打印```Rule```的规则的辅助方法
     */
    abstract toJSON(): object;
    /**
     * 判断是否会发生左递归的方法
     * @param rule 开始计算的规则
     */
    abstract maybeLeftRecursion(rule: DelayRule<any>): boolean;
}

/**
 * 描述```TerminalRule```的配置的接口
 */
export interface TerminalOptions {
    /**
     * 匹配终结符的正则表达式，或者是字符串
     */
    reg: RegExp | string;
    /**
     * 是否忽略，默认为```false```
     */
    ignore?: boolean;
    /**
     * 生成的```Ast```的类型，默认为```TerminalAst```
     */
    ast?: typeof TerminalAst;
}

/**
 * 描述```TerminalRule```的配置的接口
 * 
 * （仅内部使用）
 */
interface InnerTerminalOptions {
    /**
     * 匹配终结符的正则表达式
     */
    reg: RegExp;
    /**
     * 是否忽略
     */
    ignore: boolean;
    /**
     * 生成的```Ast```的类型
     */
    ast: typeof TerminalAst;
}

/**
 * 用于描述结束的```Rule```类
 */
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

/**
 * 用于描述终结符的```Rule```类
 */
export class TerminalRule extends Rule {
    /**
     * ```TerminalRule```的配置
     */
    readonly options: InnerTerminalOptions;

    /**
     * @param options ```TerminalRule```的配置
     */
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

    /**
     * 转换字符串为正则表达式的辅助方法
     * @param str 字符串
     */
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

/**
 * 用于描述非终结符的```Rule```类
 * 
 * T 为继承了```DelayAst```的类
 */
export class DelayRule<T extends typeof DelayAst> extends Rule {
    /**
     * 包装的规则定义
     */
    private _rule: Rule | undefined;
    /**
     * 包装的规则定义
     */
    get rule() {
        if (!this._rule) throw new RuleNotDefinedError();
        return this._rule;
    }
    /**
     * @param ast 生成的```Ast```的类型
     */
    constructor(readonly ast: T) {
        super();
    }
    /**
     * 定义规则的方法
     * @param rule 规则
     */
    define(rule: Rule) {
        if (this._rule) throw new RuleNotDefinedError();
        this._rule = rule;
    }

    /**
     * 缓存是否可能发生左递归
     */
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

/**
 * 用于描述与规则的```Rule```类
 */
class AndRule extends Rule {
    /**
     * @param left 左侧规则
     * @param right 右侧规则
     */
    constructor(private left: Rule, private right: Rule) {
        super();
    }
    getMatcher(): Matcher {
        return new AndMatcher(this.left, this.right);
    }

    /**
     * 将连起来的连续的与规则的子规则放到一个数组里面的辅助方法
     */
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

/**
 * 用于描述或规则的```Rule```类
 */
class OrRule extends Rule {
    /**
     * @param left 左侧规则
     * @param right 右侧规则
     */
    constructor(private left: Rule, private right: Rule) {
        super();
    }
    getMatcher(): Matcher {
        return new OrMatcher(this.left, this.right);
    }

    /**
     * 将连起来的连续的或规则的子规则放到一个数组里面的辅助方法
     */
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

/**
 * 用于描述重复规则的```Rule```类
 * 
 * 相当于```*```
 */
class RepeatRule extends Rule {
    /**
     * @param rule 被重复的规则
     */
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

/**
 * 用于描述一或多规则的```Rule```类
 * 
 * 相当于```+```
 */
class MoreRule extends Rule {
    /**
     * @param rule 被重复的规则
     */
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

/**
 * 用于描述可选则的```Rule```类
 * 
 * 相当于```?```
 */
class OptionalRule extends Rule {
    /**
     * @param rule 可选的规则
     */
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