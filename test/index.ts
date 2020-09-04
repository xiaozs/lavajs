import { RuleCollection, DelayAst, DelayRule, Parser, ParserResult, TerminalAst } from "../src";

function assert(flag: boolean): asserts flag {
    if (!flag) throw new Error();
}

class Root extends DelayAst {
}

let collection = new RuleCollection();

let test1 = collection.terminal(/test1/);
let test2 = collection.terminal(/test2/);
collection.terminal(",");

let root = collection.delay(Root);

root.define(test1.and(test2).more());

let parser = collection.getParser(root);
let res = parser.match("test1test2,test1test2");
let a = res.ast;
debugger