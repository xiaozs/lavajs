# lavajs
lavajs是一个由***typescript***写成的支持***umd***的***DSL式***的词法分析器、语法分析器库。

## 特色
* 支持***typescript***的```*.d.ts```文件
* 支持***umd***，可运行在**浏览器**和**nodejs**环境下
* 使用***DSL式***，可与js语言无缝衔接
* 支持左递归循环

## 安装
在命令行中输入：
```
npm install lavajs
```

## 引入

### cmd
```javascript
var lavajs = require("lavajs");
```

### amd
```javascript
require(["lavajs"], function(lavajs) {

})
```
```javascript
define(["lavajs"], function(lavajs) {

})
```

### es6
```javascript
import * as lavajs from "lavajs";
```

### \<script>
```html
<script src="./node_modules/lavajs/dist/index.js"></script>
<script>

lavajs

</script>
```

## 使用
此处介绍了一些常用的类型，其他的具体类型信息，可以查看包内的```*.d.ts```文件。

### TerminalRule
用于生成终止符的规则
```javascript
import { TerminalRule } from "lavajs";
// new TerminalRule(options: TerminalOptions | RegExp | string);

// 可以接受正则表达式（不支持flags）
new TerminalRule(/[0-9]+/);

// 可以接受字符串
new TerminalRule("+");

// 可以接受TerminalOptions
// interface TerminalOptions {
//     reg: RegExp | string;        // 正则表达式或字符串
//     ignore?: boolean;            // 是否忽略，默认为false
//     ast?: typeof TerminalAst;    // 生成的ast类型，默认为TerminalAst
// }
new TerminalRule({ reg: /\s+/, ignore: true });
```

### Lex
用于生成进行词法分析的Lex对象

* 一般用例：
```javascript
import { Lex, TerminalRule } from "lavajs";

// new Lex(terminalRules: TerminalRule[])

let lex = new Lex([
    new TerminalRule(/[0-9]+/),
    new TerminalRule("+"),
    new TerminalRule("-"),
    new TerminalRule("*"),
    new TerminalRule("/"),
    new TerminalRule({ reg: /\s+/, ignore: true })
]);

let result = lex.match("100 * 100");

// interface LexResult {
//     ast: TerminalAst[];          // ast数组
//     errors: Token[];             // 未能识别的token
//     ignore: TerminalAst[];       // 被忽略的ast
// }

JSON.stringify(result); 
// =>
// '{
//     "ast": [
//         {
//             "name": "TerminalAst",
//             "reg": "/[0-9]+/",
//             "token": {
//                 "content": "100",
//                 "start": {
//                     "row": 0,
//                     "col": 0
//                 },
//                 "end": {
//                     "row": 0,
//                     "col": 3
//                 }
//             }
//         },
//         {
//             "name": "TerminalAst",
//             "reg": "/\\*/",
//             "token": {
//                 "content": "*",
//                 "start": {
//                     "row": 0,
//                     "col": 4
//                 },
//                 "end": {
//                     "row": 0,
//                     "col": 5
//                 }
//             }
//         },
//         {
//             "name": "TerminalAst",
//             "reg": "/[0-9]+/",
//             "token": {
//                 "content": "100",
//                 "start": {
//                     "row": 0,
//                     "col": 6
//                 },
//                 "end": {
//                     "row": 0,
//                     "col": 9
//                 }
//             }
//         }
//     ],
//     "errors": [],
//     "ignore": [
//         {
//             "name": "TerminalAst",
//             "reg": "/\\s+/",
//             "token": {
//                 "content": " ",
//                 "start": {
//                     "row": 0,
//                     "col": 3
//                 },
//                 "end": {
//                     "row": 0,
//                     "col": 4
//                 }
//             }
//         },
//         {
//             "name": "TerminalAst",
//             "reg": "/\\s+/",
//             "token": {
//                 "content": " ",
//                 "start": {
//                     "row": 0,
//                     "col": 5
//                 },
//                 "end": {
//                     "row": 0,
//                     "col": 6
//                 }
//             }
//         }
//     ]
// }'
```

* 含有无法识别的字符时：
```javascript
import { Lex, TerminalRule } from "lavajs";

let lex = new Lex([
    new TerminalRule(/[0-9]+/),
    new TerminalRule("+"),
    new TerminalRule("-"),
    new TerminalRule("*"),
    new TerminalRule("/"),
    new TerminalRule({ reg: /\s+/, ignore: true })
]);

let result = lex.match("100.00 * 100");

JSON.stringify(result); 
// =>
// '{
//     "ast": [
//         {
//             "name": "TerminalAst",
//             "reg": "/[0-9]+/",
//             "token": {
//                 "content": "100",
//                 "start": {
//                     "row": 0,
//                     "col": 0
//                 },
//                 "end": {
//                     "row": 0,
//                     "col": 3
//                 }
//             }
//         },
//         {                                   // 此处多出了'00'
//             "name": "TerminalAst",
//             "reg": "/[0-9]+/",
//             "token": {
//                 "content": "00",
//                 "start": {
//                     "row": 0,
//                     "col": 4
//                 },
//                 "end": {
//                     "row": 0,
//                     "col": 6
//                 }
//             }
//         },
//         {
//             "name": "TerminalAst",
//             "reg": "/\\*/",
//             "token": {
//                 "content": "*",
//                 "start": {
//                     "row": 0,
//                     "col": 7
//                 },
//                 "end": {
//                     "row": 0,
//                     "col": 8
//                 }
//             }
//         },
//         {
//             "name": "TerminalAst",
//             "reg": "/[0-9]+/",
//             "token": {
//                 "content": "100",
//                 "start": {
//                     "row": 0,
//                     "col": 9
//                 },
//                 "end": {
//                     "row": 0,
//                     "col": 12
//                 }
//             }
//         }
//     ],
//     "errors": [
//         {                                   // 此处多出了’.‘
//             "content": ".",
//             "start": {
//                 "row": 0,
//                 "col": 3
//             },
//             "end": {
//                 "row": 0,
//                 "col": 4
//             }
//         }
//     ],
//     "ignore": [
//         {
//             "name": "TerminalAst",
//             "reg": "/\\s+/",
//             "token": {
//                 "content": " ",
//                 "start": {
//                     "row": 0,
//                     "col": 6
//                 },
//                 "end": {
//                     "row": 0,
//                     "col": 7
//                 }
//             }
//         },
//         {
//             "name": "TerminalAst",
//             "reg": "/\\s+/",
//             "token": {
//                 "content": " ",
//                 "start": {
//                     "row": 0,
//                     "col": 8
//                 },
//                 "end": {
//                     "row": 0,
//                     "col": 9
//                 }
//             }
//         }
//     ]
// }'
```

### StreamLex
用于生成进行词法分析的Lex对象，接受流式数据，以事件形式返回结果

```javascript
import { StreamLex, TerminalRule } from "lavajs";

// new StreamLex(rules: TerminalRule[])

let lex = new StreamLex([
    new TerminalRule(/[0-9]+/),
    new TerminalRule("+"),
    new TerminalRule("-"),
    new TerminalRule("*"),
    new TerminalRule("/"),
    new TerminalRule({ reg: /\s+/, ignore: true })
]);

lex.on("ast", ast => console.log("ast:\n" + JSON.stringify(ast, null, 4)));
lex.on("error", token => console.log("error:\n" + JSON.stringify(token, null, 4)));
lex.on("ignore", ast => console.log("ignore:\n" + JSON.stringify(ast, null, 4)));
lex.on("end", () => console.log("end"));

lex.match("100.00");
// ast:
// {
//     "name": "TerminalAst",
//     "reg": "/[0-9]+/",
//     "token": {
//         "content": "100",
//         "start": {
//             "row": 0,
//             "col": 0
//         },
//         "end": {
//             "row": 0,
//             "col": 3
//         }
//     }
// }

// error:
// {
//     "content": ".",
//     "start": {
//         "row": 0,
//         "col": 3
//     },
//     "end": {
//         "row": 0,
//         "col": 4
//     }
// }

// warning：此处并没有返回'00'，因为并不知道'00'后面是否有其他的数字

lex.match(" *");
// ast:
// {
//     "name": "TerminalAst",
//     "reg": "/[0-9]+/",
//     "token": {
//         "content": "00",
//         "start": {
//             "row": 0,
//             "col": 4
//         },
//         "end": {
//             "row": 0,
//             "col": 6
//         }
//     }
// }

// ignore:
// {
//     "name": "TerminalAst",
//     "reg": "/\\s+/",
//     "token": {
//         "content": " ",
//         "start": {
//             "row": 0,
//             "col": 6
//         },
//         "end": {
//             "row": 0,
//             "col": 7
//         }
//     }
// }

lex.match(" 100");
// ast:
// {
//     "name": "TerminalAst",
//     "reg": "/\\*/",
//     "token": {
//         "content": "*",
//         "start": {
//             "row": 0,
//             "col": 7
//         },
//         "end": {
//             "row": 0,
//             "col": 8
//         }
//     }
// }

// ignore:
// {
//     "name": "TerminalAst",
//     "reg": "/\\s+/",
//     "token": {
//         "content": " ",
//         "start": {
//             "row": 0,
//             "col": 8
//         },
//         "end": {
//             "row": 0,
//             "col": 9
//         }
//     }
// }

// warning：此处也并没有返回'100'，理由同上

lex.end();
// ast:
// {
//     "name": "TerminalAst",
//     "reg": "/[0-9]+/",
//     "token": {
//         "content": "100",
//         "start": {
//             "row": 0,
//             "col": 9
//         },
//         "end": {
//             "row": 0,
//             "col": 12
//         }
//     }
// }

// end
```

* 另有```reset```方法，用于重置```StreamLex```对象
```javascript
lex.reset();
```

### RuleCollection
用于生成语法分析器的对象
```javascript
import { RuleCollection, TerminalAst, DelayAst } from "lavajs";

class Num extends TerminalAst {
    exec() {
        return +this.token.content;
    }
}

class Add extends TerminalAst {
    exec(left: number, right: number) {
        return left + right;
    }
}

class Sub extends TerminalAst {
    exec(left: number, right: number) {
        return left - right;
    }
}

class Mul extends TerminalAst {
    exec(left: number, right: number) {
        return left * right;
    }
}

class Div extends TerminalAst {
    exec(left: number, right: number) {
        return left / right;
    }
}

class Expr extends DelayAst {
    get left() {
        return this.children[0];
    }
    get operator() {
        return this.children[1];
    }
    get right() {
        return this.children[2];
    }
    exec() {
        return this.operator.exec(this.left.exec(), this.right.exec());
    }
}

let collection = new RuleCollection();

// 省略空格
collection.terminal({ reg: /\s+/, ignore: true });

// num => [0-9]+
let num = collection.terminal({
    reg: /[0-9]+/,
    ast: Num
});

// add => "+"
let add = collection.terminal({
    reg: "+",
    ast: Add
})

// sub => "-"
let sub = collection.terminal({
    reg: "-",
    ast: Sub
})

// mul => "*"
let mul = collection.terminal({
    reg: "*",
    ast: Mul
})

// div => "/"
let div = collection.terminal({
    reg: "/",
    ast: Div
})

// 无特殊Ast对象的规则可以直接定义中间变量使用
// operator => add | sub | mul | div
let operator = add.or(sub).or(mul).or(div);

// 非终结符规则的定义需要分开两步（先声明，后定义）
let expr = collection.delay(Expr);
// expr => num | operator | num
expr.define(num.and(operator).and(num));

// 获取语法分析器Parser
let parser = collection.getParser(expr);
let result = parser.match("100 * 100");

// interface ParserResult<T extends typeof DelayAst> {
//     ast?: InstanceType<T>;               // 生成的ast树，可通过判断是否为undefined，来判断是否成功
//     ignoreAst: TerminalAst[];            // 被跳过的ast
//     errorAst: Ast[];                     // 不符合语法规则的ast
//     errorToken: Token[];                 // 不符合词法规则的token
// }

console.log(JSON.stringify(result));
// {
//     "ast": {
//         "name": "Expr",
//         "children": [
//             {
//                 "name": "Num",
//                 "reg": "/[0-9]+/",
//                 "token": {
//                     "content": "100",
//                     "start": {
//                         "row": 0,
//                         "col": 0
//                     },
//                     "end": {
//                         "row": 0,
//                         "col": 3
//                     }
//                 }
//             },
//             {
//                 "name": "Mul",
//                 "reg": "/\\*/",
//                 "token": {
//                     "content": "*",
//                     "start": {
//                         "row": 0,
//                         "col": 4
//                     },
//                     "end": {
//                         "row": 0,
//                         "col": 5
//                     }
//                 }
//             },
//             {
//                 "name": "Num",
//                 "reg": "/[0-9]+/",
//                 "token": {
//                     "content": "100",
//                     "start": {
//                         "row": 0,
//                         "col": 6
//                     },
//                     "end": {
//                         "row": 0,
//                         "col": 9
//                     }
//                 }
//             }
//         ]
//     },
//     "ignoreAst": [
//         {
//             "name": "TerminalAst",
//             "reg": "/\\s+/",
//             "token": {
//                 "content": " ",
//                 "start": {
//                     "row": 0,
//                     "col": 3
//                 },
//                 "end": {
//                     "row": 0,
//                     "col": 4
//                 }
//             }
//         },
//         {
//             "name": "TerminalAst",
//             "reg": "/\\s+/",
//             "token": {
//                 "content": " ",
//                 "start": {
//                     "row": 0,
//                     "col": 5
//                 },
//                 "end": {
//                     "row": 0,
//                     "col": 6
//                 }
//             }
//         }
//     ],
//     "errorAst": [],
//     "errorToken": []
// }

let execResult = result.ast.exec();
console.log(execResult);        // 10000
```
另外有StreamParser，接受流式数据，以事件形式返回结果
```javascript
let parser = collection.getStreamParser(expr);
parser.on("error", result => result);
parser.on("ignore", result => result);
parser.on("success", result => result);
parser.on("fail", result => result);
parser.on("end", result => {
    let execResult = result.ast.exec();
    console.log(execResult);
});

parser.match("100 + 100");
parser.end();
// 200
```
```StreamParser```可通过```reset```方法重置
```javascript
parser.reset();
```