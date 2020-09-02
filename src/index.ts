import { Lex } from "./Lex";
import { TerminalRule } from "./Rule";

let lex = new Lex([
    new TerminalRule(/(\d)\1/),
    new TerminalRule(/test(\d)?/)
]);

let res = lex.match("11,test2,test");
debugger;