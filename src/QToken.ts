import Log from "./Util";

export enum TokenType {
    WHERE = "WHERE",
    FILTER = "FILTER",
    OPTIONS = "OPTIONS",
    NOT = "NOT",
    IS = "IS",
    LT = "LT",
    GT = "GT",
    EQ = "EQ",
    AND = "AND",
    OR = "OR",
}

export class QToken {
    private type: any;
    private value: any;
    private numberOfChildren: number;
    constructor(type: any, value: any, numOfChildren: number) {
        this.type = type;
        this.value = value;
        this.numberOfChildren = numOfChildren;
    }
    public getType(): any {
        return this.type;
    }
    public getValue(): any {
        return this.value;
    }
    public setNumOfChildren(num: number): void {
        this.numberOfChildren = num;
    }
    public getNumOfChildren(): number {
        return this.numberOfChildren;
    }
    public decrementChildren(): void {
        this.numberOfChildren--;
    }
    public addChildren(num: number): void {
        this.numberOfChildren += num;
    }
}
