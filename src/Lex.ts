import { EventEmmiter } from "./utils/EventEmmiter";
import type { TerminalAst } from "./Ast";
import type { TerminalRule } from "./Rule";
import { replaceSpecialChar } from "./utils/utils";

export interface Pos {
    row: number;
    col: number;
}

export interface Token {
    content: string;
    start: Pos;
    end: Pos;
}

class PositionLogger {
    private row = 0;
    private col = 0;
    private static newLineReg = /(?:\r\n|\r|\n)/;

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
    reset() {
        this.row = 0;
        this.col = 0;
    }
    private getContentMessage(content: string) {
        let strArr = content.split(PositionLogger.newLineReg);
        let lastLine = strArr[strArr.length - 1];
        return {
            newLineCount: strArr.length - 1,
            lastLineLength: lastLine.length
        };
    }
}


export class StreamLex extends EventEmmiter<{ error: [Token], ast: [TerminalAst], ignore: [TerminalAst], end: [] }> {
    private reg: RegExp;
    private groupIndexes: number[];

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

    private regHandler(rule: TerminalRule, refAdd: number): { regText: string, groupCount: number } {
        let regText = rule.options.reg.source;
        let groupCount = this.getCaptureGroupCount(regText);
        return {
            regText: this.replaceRef(regText, groupCount, refAdd),
            groupCount,
        }
    }

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

    private positionLoger = new PositionLogger();
    private strCache = "";
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

    reset() {
        this.positionLoger.reset();
        this.strCache = "";
    }

    match(str: string) {
        this.push(str, false);
    }

    end() {
        this.push("", true);
        this.reset();
    }
}

export interface LexResult {
    ast: TerminalAst[];
    errors: Token[];
    ignore: TerminalAst[];
}

export class Lex {
    private streamLex: StreamLex;
    constructor(terminalRules: TerminalRule[]) {
        this.streamLex = new StreamLex(terminalRules);
    }

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