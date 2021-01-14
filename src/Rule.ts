import { Ast, DelayAst, DelayAstConstructor, TerminalAst } from "./Ast";
import { AndMatcher, DelayMatcher, EndMatcher, Matcher, MoreMatcher, OptionalMatcher, OrMatcher, RepeatMatcher, TerminalMatcher } from "./Matcher";
import { Parser, StreamParser } from "./Parser";
import { replaceSpecialChar, UnreachableError } from "./utils/utils";

/**
 * 描述插值字符串中规则的Ast的接口
 */
interface ItemAst extends Ast {
    /**
     * 获取描述的组合规则的方法
     * @param rules 被插入的规则的数组
     */
    getRule(rules: Rule[]): Rule;
}

/**
 * 插值字符串规则，根规则的Ast类
 */
class BnfAst extends DelayAst<[ItemAst]> implements ItemAst {
    getRule(rules: Rule[]): Rule {
        return this.children[0].getRule(rules);
    }
}

/**
 * 插值字符串规则，大括号包括的组合规则的Ast类
 */
class GroupItemAst extends DelayAst<[any, ItemAst, any]> implements ItemAst {
    getRule(rules: Rule[]): Rule {
        return this.children[1].getRule(rules);
    }
}

/**
 * 插值字符串规则，```+*?```组合规则的Ast类
 */
class OperatorItemAst extends DelayAst<[ItemAst, TerminalAst]> implements ItemAst {
    getRule(rules: Rule[]): Rule {
        let rule = this.children[0].getRule(rules);
        let operator = this.children[1].token.content;
        if (operator === "+") {
            return rule.more();
        }
        if (operator === "*") {
            return rule.repeat();
        }
        if (operator === "?") {
            return rule.optional();
        }
        throw new UnreachableError();
    }
}

/**
 * 插值字符串规则，与组合规则的Ast类
 */
class AndItemAst extends DelayAst<[ItemAst, ItemAst]> implements ItemAst {
    getRule(rules: Rule[]): Rule {
        let left = this.children[0].getRule(rules);
        let right = this.children[1].getRule(rules);
        return left.and(right);
    }
}

/**
 * 插值字符串规则，或组合规则的Ast类
 */
class OrItemAst extends DelayAst<[ItemAst, any, ItemAst]> implements ItemAst {
    getRule(rules: Rule[]): Rule {
        let left = this.children[0].getRule(rules);
        let right = this.children[2].getRule(rules);
        return left.or(right);
    }
}

/**
 * 插值字符串规则，插值规则的Ast类
 */
class SimpleItemAst extends TerminalAst implements ItemAst {
    getRule(rules: Rule[]): Rule {
        let index = +this.token.content.slice(1);
        return rules[index];
    }
}

/**
 * 获取插值字符串规则语法分析器的方法
 */
function getBnfParser() {
    let collection = new RuleCollection();
    collection.terminal({ reg: /[\s\r\n]+/, ignore: true });

    let simpleRule = collection.terminal({ reg: /\$[0-9]+/, ast: SimpleItemAst });

    let left = collection.terminal("(");
    let right = collection.terminal(")");

    let or = collection.terminal("|");

    let more = collection.terminal("+");
    let optional = collection.terminal("?");
    let repeat = collection.terminal("*");
    let operator = more.or(optional).or(repeat);

    let groupItem = collection.delay(GroupItemAst);
    let operatorItem = collection.delay(OperatorItemAst);
    let andItem = collection.delay(AndItemAst);
    let orItem = collection.delay(OrItemAst);
    let item = collection.delay(BnfAst);

    groupItem.define(left.and(item).and(right));
    operatorItem.define(item.and(operator));
    andItem.define(item.and(item));
    orItem.define(item.and(or).and(item));

    item.define(
        simpleRule
            .or(andItem)
            .or(operatorItem)
            .or(orItem)
            .or(groupItem)
    );

    return collection.getParser(item);
}

/**
 * ```Rule.bnf```规则定义错误的异常
 */
export class RuleSyntaxError extends Error {
    constructor() {
        super();
        Object.setPrototypeOf(this, this.constructor.prototype);
    }
}

/**
 * ```DelayRule```规则已经定义的异常
 */
export class RuleDefinedError extends Error {
    constructor() {
        super();
        Object.setPrototypeOf(this, this.constructor.prototype);
    }
}

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
 * ```TerminalRule```规则不应匹配空字符的异常
 */
export class RuleMatchEmptyError extends Error {
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
        let res = Rule.terminal(options);
        this.rules.push(res);
        return res;
    }

    /**
     * 生成```DelayRule```，并在当前规则集```RuleCollection```中添加该规则的方法，
     * @param ast 自定义生成```Ast```的类
     */
    delay<A extends Ast[], R extends DelayAst<A>>(ast: DelayAstConstructor<A, R>): DelayRule<A, R> {
        let res = Rule.delay(ast);
        this.rules.push(res);
        return res;
    }

    /**
     * 生成语法分析器
     * @param root 指定作为根对象的规则
     */
    getParser<A extends Ast[], R extends DelayAst<A>>(root: DelayRule<A, R>): Parser<A, R> {
        let isIn = this.rules.includes(root);
        if (!isIn) throw new RuleNotInCollectionError();
        return new Parser(root, this.rules);
    }

    /**
     * 生成语法分析器
     * （接受流式数据，以事件形式返回结果）
     * @param root 指定作为根对象的规则
     */
    getStreamParser<A extends Ast[], R extends DelayAst<A>>(root: DelayRule<A, R>): StreamParser<A, R> {
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

    /**
     * 规则集转换成字符串
     */
    toString() {
        return JSON.stringify(this);
    }
}

/**
 * 规则的类
 */
export abstract class Rule {
    private static bnfParser?: Parser<[ItemAst], BnfAst>;
    /**
     * 合并规则的方法
     * 
     * （使用插值字符串的方式）
     * @param strArr 规则的元字符的数组
     * @param rules 被组合的规则的数组
     * 
     * @example
     * ```javascript
     * let collection = new RuleCollection();
     * let add = collection.terminal("+");
     * let sub = collection.terminal("-");
     * let mul = collection.terminal("*");
     * let div = collection.terminal("/");
     * let operator = Rule.bnf`${add} | ${sub} | ${mul} | ${div}`;
     * ```
     */
    static bnf(strArr: readonly string[], ...rules: Rule[]): Rule {
        this.bnfParser = this.bnfParser ?? getBnfParser();

        let bnfStr = "";
        for (let i = 0; i < rules.length; i++) {
            bnfStr += strArr[i] + "$" + i;
        }
        bnfStr += strArr[rules.length];

        let res = this.bnfParser.match(bnfStr, false);
        if (!res.ast) throw new RuleSyntaxError();
        return res.ast.getRule(rules);
    }
    /**
     * 生成```DelayRule```
     * @param ast 自定义生成```Ast```的类
     */
    static delay<A extends Ast[], R extends DelayAst<A>>(ast: DelayAstConstructor<A, R>): DelayRule<A, R> {
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
        let leftRules = this instanceof AndRule ? this.rules : [this];
        let rightRules = rule instanceof AndRule ? rule.rules : [rule];
        return new AndRule([...leftRules, ...rightRules]);
    }
    /**
     * 生成一个新规则的方法，新规则需满足原规则，或满足另一个规则
     * @param rule 另一规则
     */
    or(rule: Rule): Rule {
        let leftRules = this instanceof OrRule ? this.rules : [this];
        let rightRules = rule instanceof OrRule ? rule.rules : [rule];
        return new OrRule([...leftRules, ...rightRules]);
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
    abstract maybeLeftRecursion(rule: DelayRule<any, any>): boolean;

    /**
     * 规则转换成字符串
     */
    toString() {
        return JSON.stringify(this);
    }
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
    maybeLeftRecursion(rule: DelayRule<any, any>): boolean {
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

        this.checkReg();
    }

    /**
     * 检查正则表达式，其不能匹配空字符
     */
    private checkReg() {
        let matchEmpty = this.options.reg.test("");
        if (matchEmpty) throw new RuleMatchEmptyError();
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
    maybeLeftRecursion(rule: DelayRule<any, any>): boolean {
        return false;
    }
}

/**
 * 用于描述非终结符的```Rule```类
 * 
 * T 为继承了```DelayAst```的类
 */
export class DelayRule<A extends Ast[], R extends DelayAst<A>> extends Rule {
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
    constructor(readonly ast: DelayAstConstructor<A, R>) {
        super();
    }
    /**
     * 定义规则的方法
     * @param rule 规则
     */
    define(rule: Rule) {
        if (this._rule) throw new RuleDefinedError();
        this._rule = rule;
    }

    /**
     * 定义规则的方法
     * 
     * （使用插值字符串的方式）
     * @param strArr 规则的元字符的数组
     * @param rules 被组合的规则的数组
     * 
     * @example
     * ```javascript
     * let collection = new RuleCollection();
     * let num = collection.terminal(/[0-9]+/);
     * let add = collection.terminal("+");
     * let sub = collection.terminal("-");
     * let mul = collection.terminal("*");
     * let div = collection.terminal("/");
     * let operator = Rule.bnf`${add} | ${sub} | ${mul} | ${div}`;
     * 
     * let expr = collection.delay(Expr);
     * expr.defineBnf`${num} ${operator} ${num}`;
     * ```
     */
    defineBnf(strArr: readonly string[], ...rules: Rule[]) {
        let rule = Rule.bnf(strArr, ...rules);
        this.define(rule);
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
    maybeLeftRecursion(rule: DelayRule<any, any>): boolean {
        if (rule === this) return true;
        return this.rule.maybeLeftRecursion(rule);
    }
}

/**
 * 用于描述与规则的```Rule```类
 */
class AndRule extends Rule {
    /**
     * @param rules 规则集
     */
    constructor(readonly rules: readonly Rule[]) {
        super();
    }
    getMatcher(): Matcher {
        return new AndMatcher(this.rules);
    }
    toJSON(): object {
        return {
            name: "$and",
            rule: this.rules
        }
    }
    maybeLeftRecursion(rule: DelayRule<any, any>): boolean {
        let first = this.rules[0];
        return first.maybeLeftRecursion(rule);
    }
}

/**
 * 用于描述或规则的```Rule```类
 */
class OrRule extends Rule {
    /**
     * @param rules 规则集
     */
    constructor(readonly rules: readonly Rule[]) {
        super();
    }
    getMatcher(): Matcher {
        return new OrMatcher(this.rules);
    }

    toJSON(): object {
        return {
            name: "$or",
            rule: this.rules
        }
    }
    maybeLeftRecursion(rule: DelayRule<any, any>): boolean {
        return this.rules.some(it => it.maybeLeftRecursion(rule));
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
    maybeLeftRecursion(rule: DelayRule<any, any>): boolean {
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
    maybeLeftRecursion(rule: DelayRule<any, any>): boolean {
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
    maybeLeftRecursion(rule: DelayRule<any, any>): boolean {
        return this.rule.maybeLeftRecursion(rule);
    }
}