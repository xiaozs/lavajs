import { RuleCollection, DelayAst, DelayRule, Parser, ParserResult, TerminalAst } from "../src";

function assert(flag: boolean): asserts flag {
    if (!flag) throw new Error();
}

class X extends DelayAst {
}

class Expr extends DelayAst {
}

let collection = new RuleCollection();

let num = collection.terminal("num");
let mins = collection.terminal("-");

let x = collection.delay(X);
let expr = collection.delay(Expr);

x.define(expr);
expr.define((x.and(mins).and(num)).or(num));

let parser = collection.getParser(x);
let res = parser.match("num-num-num");

console.log(JSON.stringify(res, null, 4));
console.log(JSON.stringify(collection, null, 4));
debugger