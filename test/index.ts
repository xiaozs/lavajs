
import { RuleCollection, TerminalAst, DelayAst, Rule } from "../src";

class Num extends TerminalAst {
    exec() {
        return +this.token.content;
    }
}

interface Operator extends TerminalAst {
    exec(left: number, right: number): number;
}

class Add extends TerminalAst implements Operator {
    exec(left: number, right: number) {
        return left + right;
    }
}

class Sub extends TerminalAst implements Operator {
    exec(left: number, right: number) {
        return left - right;
    }
}

class Mul extends TerminalAst implements Operator {
    exec(left: number, right: number) {
        return left * right;
    }
}

class Div extends TerminalAst implements Operator {
    exec(left: number, right: number) {
        return left / right;
    }
}

class Expr extends DelayAst {
    get left() {
        return this.children[0] as Num;
    }
    get operator() {
        return this.children[1] as Operator;
    }
    get right() {
        return this.children[2] as Num;
    }
    exec() {
        return this.operator.exec(this.left.exec(), this.right.exec());
    }
}

let collection = new RuleCollection();

collection.terminal({ reg: /\s+/, ignore: true });

let num = collection.terminal({
    reg: /[0-9]+/,
    ast: Num
});

let add = collection.terminal({
    reg: "+",
    ast: Add
})

let sub = collection.terminal({
    reg: "-",
    ast: Sub
})

let mul = collection.terminal({
    reg: "*",
    ast: Mul
})

let div = collection.terminal({
    reg: "/",
    ast: Div
})

// operator => add | sub | mul | div
let operator = Rule.bnf`${add} | ${sub} | ${mul} | ${div}`;


let expr = collection.delay(Expr);
// expr => num operator num
expr.defineBnf`${num} ${operator} ${num}`;

let parser = collection.getStreamParser(expr);
parser.on("error", result => result);
parser.on("ignore", result => result);
parser.on("success", result => result);
parser.on("fail", result => result);
parser.on("end", result => {
    let execResult = result.ast!.exec();
    console.log(execResult);
});

parser.match("100 + 100");
parser.end();
// 200