import type { Token } from "./Lex";
import type { TerminalRule } from "./Rule";
import { UnreachableError } from "./utils/utils";

/**
 * 该Ast节点不存在父节点
 */
export class AstNoParentError extends Error {
    constructor() {
        super("该Ast节点不存在父节点");
        Object.setPrototypeOf(this, this.constructor.prototype);
    }
}

/**
 * 该Ast节点父节点不能修改
 */
export class ParentError extends Error {
    constructor() {
        super("该Ast节点父节点不能修改");
        Object.setPrototypeOf(this, this.constructor.prototype);
    }
}

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
    /**
     * 当前Ast的父节点
     */
    private _parent: ChildrenAst<Ast[]> | null = null;
    /**
     * 当前Ast的父节点
     */
    get parent() {
        return this._parent;
    }
    set parent(p: ChildrenAst<Ast[]> | null) {
        if (this._parent && !(this instanceof TerminalAst)) throw new Error();
        this._parent = p;
    }
    /**
     * 将当前节点替换为新节点
     * @param newAst 新节点
     */
    replaceWith(newAst: this): void {
        if (!this.parent) throw new Error();
        let index = this.parent.children.indexOf(this);
        this.parent.children.splice(index, 1, newAst);
        newAst.parent = this.parent;
    }

    /**
     * 转化为字符串
     */
    toString() {
        return JSON.stringify(this);
    }
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
export abstract class ChildrenAst<T extends Ast[]> extends Ast {
    /**
     * @param children 子元素数组
     */
    constructor(public children: T) {
        super();
        for (let child of children) {
            child.parent = this;
        }
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

export interface DelayAstConstructor<A extends Ast[], R extends DelayAst<A>> {
    new(children: A): R;
}

/**
 * 用于描述非终结符的```Ast```类
 * 
 * 可通过对其进行继承来自定义词法或语法分析中生成抽象语法树类型
 */
export class DelayAst<T extends Ast[] = Ast[]> extends ChildrenAst<T> {
}

/**
 * 用于描述非终结符的```Ast```类
 * 
 * 相当于```*```
 */
export class RepeatAst<T extends Ast[] = Ast[]> extends ChildrenAst<T> {
}


/**
 * 用于描述非终结符的```Ast```类
 * 
 * 相当于```+```
 */
export class MoreAst<T extends Ast[] = Ast[]> extends ChildrenAst<T> {
}


/**
 * 用于描述非终结符的```Ast```类
 * 
 * 相当于```?```
 */
export class OptionalAst<T extends Ast[] = Ast[]> extends ChildrenAst<T> {
}