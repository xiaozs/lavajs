import { RuleCollection, DelayAst, DelayRule, Parser, ParserResult, TerminalAst } from "../src";

function assert(flag: boolean): asserts flag {
    if (!flag) throw new Error();
}

class Root extends DelayAst {
    get left() {
        return this.children[0] as TerminalAst;
    }
    get right() {
        return this.children[1] as TerminalAst;
    }
}

let collection = new RuleCollection();

let test1 = collection.terminal(/test1/);
let test2 = collection.terminal(/test2/);

let root = collection.delay(Root);

root.define(test1.and(test2));

let parser = collection.getParser(root);
let res = parser.match("test1test2");
let a = res.ast;

assert(a?.left.token.content === "test1");
assert(a?.right.token.content === "test2");