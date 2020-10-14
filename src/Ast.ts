import type { TerminalRule } from "./Rule";
import type { Token } from "./Lex";
import { UnreachableError } from "./utils/utils";

/**
 * 抽象语法树```Ast```的根父类
 */
export abstract class Ast {
    /**
     * 将```Ast```树转换成```TerminalAst```数组的方法
     */
    abstract toTerminalAst(): TerminalAst[];
    /**
     * 方便使用```JSON.stringify```方法打印```Ast```的结构的辅助方法
     * 
     * （应通过调用```JSON.stringify```来使用，不应该直接调用）
     */
    abstract toJSON(): object;
}

/**
 * 用于描述输入结束的```Ast```类
 */
export class EndAst extends Ast {
    toTerminalAst(): TerminalAst[] {
        throw new UnreachableError();
    }
    toJSON(): object {
        return {
            name: this.constructor.name
        }
    }
}

/**
 * 用于描述终结符的```Ast```类
 * 
 * 可通过对其进行继承来自定义词法或语法分析中生成抽象语法树类型
 */
export class TerminalAst extends Ast {
    /**
     * @param token token
     * @param rule 对应的```TerminalRule```规则
     */
    constructor(readonly token: Token, readonly rule: TerminalRule) {
        super();
    }
    toTerminalAst(): TerminalAst[] {
        return [this];
    }
    toJSON(): object {
        return {
            name: this.constructor.name,
            reg: this.rule.options.reg.toString(),
            token: this.token,
        }
    }
}

/**
 * 用于描述含有子元素的```Ast```类
 */
export abstract class ChildrenAst extends Ast {
    /**=
     * @param children 包含子元素的数组
     */
    constructor(public children: Ast[]) {
        super();
    }
    toTerminalAst(): TerminalAst[] {
        let res: TerminalAst[] = [];
        for (let it of this.children) {
            if (it instanceof TerminalAst) {
                res.push(it);
            } else if (it instanceof ChildrenAst) {
                let terminals = it.toTerminalAst();
                res.push(...terminals);
            } else {
                throw new UnreachableError();
            }
        }
        return res;
    }
    toJSON(): object {
        return {
            name: this.constructor.name,
            children: this.children
        }
    }
}

/**
 * 用于描述非终结符的```Ast```类
 * 
 * 可通过对其进行继承来自定义词法或语法分析中生成抽象语法树类型
 */
export class DelayAst extends ChildrenAst {
}

/**
 * 用于描述非终结符的```Ast```类
 * 
 * 相当于```*```
 */
export class RepeatAst extends ChildrenAst {
}


/**
 * 用于描述非终结符的```Ast```类
 * 
 * 相当于```+```
 */
export class MoreAst extends ChildrenAst {
}


/**
 * 用于描述非终结符的```Ast```类
 * 
 * 相当于```?```
 */
export class OptionalAst extends ChildrenAst {
}