import Log from "../Util";
const validFilter: string[] = ["AND", "OR", "IS", "NOT", "LT", "GT", "EQ"];
const mathCompare: string[] = ["LT", "GT", "EQ"];

export default class WhereRebuilder {

    constructor() {
        Log.trace("WhereRebuilder::init()");
    }

    public rebuilder(where: any): any {
        if (Object.keys(where).length === 0) {
            return where;
        }
        let newWhere: any = {};
        let firstKey = Object.keys(where)[0];
        if (validFilter.indexOf(firstKey) === -1) {
            throw {code: 400, body: {error: "Invalid"}};
        }
        switch (firstKey) {
            case "IS":
            case "LT":
            case "GT":
            case "EQ":
                newWhere = where;
                break;
            default:
                newWhere = this.buildParts(where);
        }
        return newWhere;
    }

    private buildParts(part: any): any {
        let newPart: any = {};
        const key = Object.keys(part)[0];
        const val = part[key];
        switch (key) {
            case "IS":
            case "LT":
            case "GT":
            case "EQ":
                return part;
            case "AND":
            case "OR":
                newPart[key] = this.buildANDOR(val, key);
                break;
            case "NOT":
                newPart = this.buildNOT(val);
                break;
        }
        return newPart;
    }

    private buildANDOR(part: any, key: any): any {
        if (!Array.isArray(part) || part.length < 1) {
            throw {code: 400, body: {error: "Invalid"}};
        }
        const result: any[] = [];
        for (const item of part) {
            if ((typeof item === "object") && Object.keys(item)[0] === key) {
                let subResult = this.buildANDOR(item[key], key);
                for (const i of subResult) {
                    result.push(i);
                }
            } else if ((typeof item === "object") && Object.keys(item)[0] === "NOT") {
                let subResult = this.buildParts(item);
                if (typeof subResult === "object" && Object.keys(subResult)[0] === key) {
                    let aResult = this.buildANDOR(subResult[key], key);
                    for (const i of aResult) {
                        result.push(this.buildParts(i));
                    }
                } else {
                    result.push(subResult);
                }
            } else {
                result.push(this.buildParts(item));
            }
        }
        return result;
    }

    private buildNOT(part: any): any {
        if ((typeof part !== "object") || Object.keys(part).length === 0) {
            throw {code: 400, body: {error: "Invalid"}};
        }
        let result: any = {};
        let key = Object.keys(part)[0];
        let val = part[key];
        switch (key) {
            case "IS":
                result["NOT"] = this.buildParts(part);
                break;
            case "EQ":
            case "GT":
            case "LT":
                result["OR"] = this.buildNotMath(val, key);
                break;
            case "NOT":
                result = this.buildParts(val);
                break;
            case "AND":
            case "OR":
                let aKey: string = "AND";
                if (key === "AND") {
                    aKey = "OR";
                }
                let subResult: any = {};
                subResult[aKey] = this.buildNotANDOR(val);
                result = this.buildParts(subResult);
                break;
            default:
                throw {code: 400, body: {error: "Invalid"}};
        }
        return result;
    }

    private buildNotMath(value: any, key: any): any[] {
        const keys: any[] = [];
        for (const item of mathCompare) {
            if (item !== key) {
                keys.push(item);
            }
        }
        const array: any[] = [];
        for (const item of keys) {
            let subResult: any = {};
            subResult[item] = value;
            array.push(subResult);
        }
        return array;
    }

    private buildNotANDOR(value: any): any {
        if (!Array.isArray(value) || value.length < 1) {
            throw {code: 400, body: {error: "Invalid"}};
        }
        let result: any[] = [];
        for (const item of value) {
            let subResult: any = {};
            subResult["NOT"] = item;
            result.push(this.buildParts(subResult));
        }
        return result;
    }
}
