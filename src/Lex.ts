import { EventEmmiter } from "./utils/EventEmmiter";
import type { TerminalAst } from "./Ast";
import type { TerminalRule } from "./Rule";
import { replaceSpecialChar } from "./utils/utils";

/**
 * 用于描述```Token```的内容所在的坐标的接口
 */
export interface Pos {
    /**
     * 内容所在行数
     */
    row: number;
    /**
     * 内容所在列数
     */
    col: number;
}

/**
 * 用于描述词法分析中生成```Token```的接口
 */
export interface Token {
    /**
     * 字符串内容
     */
    content: string;
    /**
     * 字符串内容的开始坐标
     */
    start: Pos;
    /**
     * 字符串内容的结束坐标
     */
    end: Pos;
}

/**
 * 用于计算```Token```内容坐标的辅助类
 */
class PositionLogger {
    /**
     * 行坐标
     */
    private row = 0;
    /**
     * 列坐标
     */
    private col = 0;
    /**
     * 描述新行的正则表达式
     */
    private static newLineReg = /(?:\r\n|\r|\n)/;

    /**
     * 将字符串内容转换成```Token```的方法
     * @param content 字符串内容
     */
    getToken(content: string): Token {
        let start: Pos = {
            row: this.row,
            col: this.col
        };

        let msg = this.getContentMessage(content);
        if (msg.newLineCount) {
            this.row += msg.newLineCount;
            this.col = 0;
        }
        this.col += msg.lastLineLength;

        let end: Pos = {
            row: this.row,
            col: this.col
        };
        return { content, start, end };
    }

    /**
     * 重置本对象的方法
     */
    reset() {
        this.row = 0;
        this.col = 0;
    }

    /**
     * 统计字符串内容的函数和最后一行长度的辅助方法
     * @param content 字符串内容
     */
    private getContentMessage(content: string) {
        let strArr = content.split(PositionLogger.newLineReg);
        let lastLine = strArr[strArr.length - 1];
        return {
            newLineCount: strArr.length - 1,
            lastLineLength: lastLine.length
        };
    }
}

/**
 * 用于进行词法分析的Lex对象
 * 
 * （接受流式数据，以事件形式返回结果）
 * @event error     发生词法错误时候触发的事件
 * @event ast       分析出```Token```时触发的事件
 * @event ignore    分析出被忽略```Token```时触发的事件
 * @event end       词法分析结束时触发的事件
 */
export class StreamLex extends EventEmmiter<{ error: [Token], ast: [TerminalAst], ignore: [TerminalAst], end: [] }> {
    /**
     * 将所有规则的```reg```拼接成的正则表达式
     */
    private reg: RegExp;
    /**
     * 正则表达式中所有反向引用对应的索引数组
     */
    private groupIndexes: number[];

    /**
     * @param rules 所有参加词法分析的终结符规则```TerminalRule```的数组
     */
    constructor(private rules: TerminalRule[]) {
        super();

        let newRegTexts: string[] = [];
        let groupIndexes: number[] = [];
        let totalGroupCount = 0;
        for (let i = 0; i < rules.length; i++) {
            let rule = rules[i];
            let refAdd = totalGroupCount + i + 1;
            let { regText, groupCount } = this.regHandler(rule, refAdd);
            totalGroupCount += groupCount;
            newRegTexts.push(regText);
            groupIndexes.push(refAdd);
        }

        let regText = newRegTexts.map(it => `(${it})`).join("|");
        this.reg = new RegExp(regText, "g");
        this.groupIndexes = groupIndexes;
    }

    /**
     * 为了进行正则表达式拼接，需要对反向引用进行改写的辅助方法
     * @param rule 当前要对反向引用进行改写的终结符规则
     * @param refAdd 当前终结符规则之前所存在的反向引用的个数
     */
    private regHandler(rule: TerminalRule, refAdd: number): { regText: string, groupCount: number } {
        let regText = rule.options.reg.source;
        let groupCount = this.getCaptureGroupCount(regText);
        return {
            regText: this.replaceRef(regText, groupCount, refAdd),
            groupCount,
        }
    }

    /**
     * 计算出正则表达式字符串中所拥有的反向引用的个数的辅助方法
     * @param regText 正则表达式字符串
     */
    private getCaptureGroupCount(regText: string) {
        let captureGroupCount = 0;
        let setGroupCount = 0;

        for (let i = 0; i < regText.length; i++) {
            let char = regText[i];
            let isEscape = this.isEscape(regText, i);
            if (isEscape) continue;

            if (setGroupCount === 0 && char === "(") {
                let nextChar = regText[i + 1];
                if (nextChar === "?") continue;
                captureGroupCount++;
            } else if (char === "[") {
                setGroupCount++;
            } else if (char === "]") {
                if (setGroupCount > 0) setGroupCount--;
            }
        }

        return captureGroupCount;
    }

    /**
     * 改写正则表达式字符串中反向引用的索引的辅助函数
     * @param regText 正则表达式字符串
     * @param groupCount 当前正则表达式字符串中反向引用的个数
     * @param refAdd 当前终结符规则之前所存在的反向引用的个数
     */
    private replaceRef(regText: string, groupCount: number, refAdd: number): string {
        return regText.replace(/\\[1-9][0-9]*/g, ($1, index) => {
            let isEscape = this.isEscape(regText, index + 1);
            if (!isEscape) return $1;

            let numText = $1.slice(1);
            let num = +numText;
            if (num <= groupCount) {
                return `\\${num + refAdd}`;
            }

            return numText.replace(/[0-7]{1,3}/, ($1) => {
                let num = parseInt($1, 8);
                return replaceSpecialChar(String.fromCharCode(num));
            })
        })
    }

    /**
     * 检查索引处字符是否转义的辅助方法
     * @param str 正则表达式字符串
     * @param i 索引
     */
    private isEscape(str: string, i: number): boolean {
        let count = 0;
        while (--i >= 0) {
            let char = str[i];
            if (char === "\\") {
                count++;
            } else {
                break;
            }
        }
        return !!(count % 2);
    }

    /**
     * 用于计算```Token```内容坐标的辅助对象
     */
    private positionLoger = new PositionLogger();
    /**
     * 待处理字符的缓存
     */
    private strCache = "";
    /**
     * 输入进行词法分析的字符的方法
     * @param str 待处理字符
     * @param isLast 是否最后一批字符
     */
    private push(str: string, isLast: boolean): void {
        this.strCache += str;
        while (true) {
            let result = this.reg.exec(this.strCache);
            if (!result) {
                if (!isLast) break;

                let token = this.positionLoger.getToken(this.strCache);
                this.trigger("error", token);
                this.trigger("end");
                break;
            };

            let content = result[0];
            let contentLength = content.length;
            let lastIndex = this.reg.lastIndex;
            this.reg.lastIndex = 0;
            if (lastIndex !== contentLength) {
                let index = lastIndex - contentLength;
                let head = this.strCache.slice(0, index);
                let tail = this.strCache.slice(index);
                this.strCache = tail;

                let token = this.positionLoger.getToken(head);
                this.trigger("error", token);
                lastIndex = contentLength;
            }

            if (!isLast && this.strCache === content) break;

            this.strCache = this.strCache.slice(lastIndex);
            let token = this.positionLoger.getToken(content);
            let rule = this.getMatchRule(result);
            let ast = new rule.options.ast(token, rule);
            if (rule.options.ignore) {
                this.trigger("ignore", ast);
            } else {
                this.trigger("ast", ast);
            }


            if (isLast && this.strCache === "") {
                this.trigger("end");
                break;
            }
        }
    }

    /**
     * 通过正则表达式的匹配结果，倒推匹配到的```TerminalRule```的辅助方法
     * @param result 正则表达式的匹配结果
     */
    private getMatchRule(result: RegExpExecArray) {
        let ruleIndex: number;
        for (let i = 1; i < result.length; i++) {
            let it = result[i];
            if (!it) continue;

            ruleIndex = this.groupIndexes.indexOf(i);
            if (ruleIndex !== -1) break;
        }

        return this.rules[ruleIndex!];
    }

    /**
     * 重置当前词法分析器的方法
     */
    reset() {
        this.positionLoger.reset();
        this.strCache = "";
    }

    /**
     * 输入进行词法分析的字符的方法
     * @param str 待处理字符
     */
    match(str: string) {
        this.push(str, false);
    }

    /**
     * 提示词法分析器已经输入了所有待处理字符的方法
     */
    end() {
        this.push("", true);
        this.reset();
    }
}

/**
 * 描述词法分析结果的接口
 */
export interface LexResult {
    /**
     * 词法分析结果生成的```TerminalAst```的数组
     */
    ast: TerminalAst[];
    /**
     * 规则无法识别的```Token```
     */
    errors: Token[];
    /**
     * 被忽略的```TerminalAst```的数组
     */
    ignore: TerminalAst[];
}

/**
 * 用于进行词法分析的Lex对象
 */
export class Lex {
    /**
     * 同步的词法分析器由流式的词法分析器```StreamLex```组合实现
     */
    private streamLex: StreamLex;
    /**
     * @param rules 所有参加词法分析的终结符规则```TerminalRule```的数组
     */
    constructor(terminalRules: TerminalRule[]) {
        this.streamLex = new StreamLex(terminalRules);
    }

    /**
     * 输入进行词法分析的字符的方法
     * @param str 待处理字符
     */
    match(str: string): LexResult {
        let ast: TerminalAst[] = []
        let errors: Token[] = [];
        let ignore: TerminalAst[] = [];

        this.streamLex.on("error", e => {
            errors.push(e);
        })
        this.streamLex.on("ast", a => {
            ast.push(a);
        })
        this.streamLex.on("ignore", a => {
            ignore.push(a);
        })

        this.streamLex.match(str);
        this.streamLex.end();

        return { ast, errors, ignore };
    }
}