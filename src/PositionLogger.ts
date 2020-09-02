export interface Pos {
    row: number;
    col: number;
}

export interface Token {
    content: string;
    start: Pos;
    end: Pos;
}

export class PositionLogger {
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
