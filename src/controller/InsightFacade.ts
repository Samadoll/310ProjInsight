import DataSetHelper from "./DataSetHelper";
import Log from "../Util";
import {IInsightFacade, InsightDataset, InsightDatasetKind, InsightResponse} from "./IInsightFacade";

/**
 * This is the main programmatic entry point for the project.
 */

import fs = require("fs");
import { Decimal } from "decimal.js";
import WhereRebuilder from "./WhereRebuilder";
const validKeysCourses: string[] =
    ["dept", "id", "avg", "instructor", "title", "pass", "fail", "audit", "uuid", "year"];
const validkeysRoom: string[] =
    ["fullname", "shortname", "number", "name", "address", "lat", "lon", "seats", "type", "furniture", "href"];
const validKeysKind: any[] = [validKeysCourses, validkeysRoom];
const DIRECTION: string[] = ["UP", "DOWN"];
const APPLYTOKEN: string[] = ["MAX", "MIN", "AVG", "COUNT", "SUM"];
let datasetName: any;
let identifier: any;

export default class InsightFacade implements IInsightFacade {
    private dataset: { [key: string]: any };

    constructor() {
        Log.trace("InsightFacadeImpl::init()");
        this.dataset = {};
        if (fs.existsSync("cachedData/")) {
            const paths = fs.readdirSync("cachedData/");
            for (const path of paths) {
                const fileId: any = path.substring(0, (path.indexOf(".")));
                let content = fs.readFileSync("cachedData/" + path, "utf-8");
                this.dataset[fileId] = JSON.parse(content);
            }
        }
    }

    public addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<InsightResponse> {
        // check same id
        if (typeof this.dataset[id] !== "undefined") {
            return Promise.reject({code: 400, body: {error: "Id already exists."}});
        }
        const dataSetHelper = new DataSetHelper();
        return dataSetHelper.addDataSetHelper(id, content, kind)
            .then((resultDataset: any) => {
                this.dataset[id] = resultDataset;
                return Promise.resolve({code: 204, body: null});
            })
            .catch((err: any) => {
                if (err.message) {
                    return Promise.reject({code: 400, body: {error: err.message}});
                } else {
                    return Promise.reject({code: 400, body: {error: "Unknown error"}});
                }
            });
    }

    public removeDataset(id: string): Promise<InsightResponse> {
        if (typeof this.dataset[id] !== "undefined") {
            delete this.dataset[id];
            this.remove(id);
            return Promise.resolve({code: 204, body: null});
        }
        return Promise.reject({code: 404, body: {error: "data with provided id doesn't exist."}});
    }

    public performQuery(query: any): Promise<InsightResponse> {
        datasetName = 0; // for checking if accessing two datasets at the same time
        identifier = 0; // for checking if two data are the same
        let where: any = {};
        try { // refactored
            this.verifyEBNF(query, "INITIAL");
            where = new WhereRebuilder().rebuilder(query["WHERE"]);
        } catch (err) {
            return Promise.reject(err);
        }
        // const where: any = query["WHERE"];
        const a = where;
        const options: any = query["OPTIONS"];
        let order: any = "";
        let group: any = "";
        let apply: any = "";
        let transformationsKeys: any = 0;
        try {
            [transformationsKeys, group, apply] = this.verifyEBNF(query, "TRANSFORMATIONS"); // refactored
            this.verifyEBNF(options, "COLUMNS");
            order = this.verifyEBNF(options, "ORDER");
        } catch (err) {
            return Promise.reject(err);
        }
        const originalCols: any[] = [];
        for (const aKey of options["COLUMNS"]) {
            try {
                this.verifyKeys(this.dataset, aKey, transformationsKeys);
            } catch (err) {
                return Promise.reject(err);
            }
            originalCols.push(aKey);
        }
        try {
            // initialCols means all keys in original dataset
            const [filteredDataset, initialCols, keyKind]
                = this.pickDataset(this.dataset, datasetName); // pick a targeted dataset
            identifier = this.getIdentifier(keyKind);

            const aResult: any = this.getResult(Object.values(filteredDataset), where, order, initialCols);
            if (group !== "" && apply !== "") {
                const transResult: any = this.getTransformations(aResult, group, apply, originalCols, order);
                return Promise.resolve({code: 200, body: {result: transResult}});
            }
            const newResult: any = this.updateResult(originalCols, aResult); // get result based on original columns
            return Promise.resolve({code: 200, body: {result: newResult}});
        } catch (err) {
            return Promise.reject({code: 400, body: {error: "invalid"}});
        }
    }

    public listDatasets(): Promise<InsightResponse> {
        const datasets: InsightDataset[] = [];
        for (const key of Object.keys(this.dataset)) {
            if (this.dataset[key as string] !== null) {
                const id: string = key as string;
                const rows: number = this.dataset[key as string].length;
                const firstElement: any = (this.dataset[key])[0];
                let kindOfData: any;
                if (firstElement[id + "_uuid"]) {
                    kindOfData = InsightDatasetKind.Courses;
                } else {
                    kindOfData = InsightDatasetKind.Rooms;
                }
                const aData: InsightDataset = {id, kind: kindOfData, numRows: rows};
                datasets.push(aData);
            }
        }
        return Promise.resolve({code: 200, body: {result: datasets}});
    }

    public getResult(data: any, where: any, order: any, columns: any): any {
        if (Object.keys(where).length === 0) {
            return this.optTokens("EMPTY", 0, data, order, columns);
        }
        try {
            return this.optTokens(Object.keys(where)[0], where[Object.keys(where)[0]], data, order, columns);
        } catch (err) {
            throw err;
        }
    }

    private operations(opt: string, cmpVal: any, data: any, order: any, columns: any, notIS: boolean): any {
        const aData: any[] = [];

        if (opt === "GT" || opt === "LT" || opt === "EQ") {
            this.verifyKeys(this.dataset, Object.keys(cmpVal)[0], 0);
            this.verifyValues(Object.keys(cmpVal)[0], cmpVal[Object.keys(cmpVal)[0]]);
            const cmp: string = Object.keys(cmpVal)[0];
            const val: any = cmpVal[Object.keys(cmpVal)[0]];
            // if ((typeof val) !== "number") {
            //     throw {code: 400, body: {error: "invalid value."}};
            // }
            for (const i of data) {
                for (const obj of i) {
                    if (this.helpGTLTEQ(obj[cmp], val, opt)) {
                        const d: any = {};
                        for (const s of columns) {
                            this.updateDatum(d, obj, s);
                        }
                        aData.push(d);
                    }
                }
            }
        } else if (opt === "IS") {
            this.verifyKeys(this.dataset, Object.keys(cmpVal)[0], 0);
            this.verifyValues(Object.keys(cmpVal)[0], cmpVal[Object.keys(cmpVal)[0]]);
            const cmp: string = Object.keys(cmpVal)[0];
            const val: any = cmpVal[Object.keys(cmpVal)[0]];
            // if ((typeof val) !== "string") {
            //     throw {code: 400, body: {error: "invalid value."}};
            // }
            if ((val[0] === "*" && (val.substring(1).indexOf("*") < val.substring(1).length - 1)
                    && val.substring(1).indexOf("*") >= 0) ||
                (val[0] !== "*" && val.indexOf("*") < val.length - 1 && val.indexOf("*") !== -1)) {
                throw {code: 400, body: {error: "invalid value."}};
            }
            let option: number = 0;
            if (val.length > 1 && (val.indexOf("*") === 0 || val.indexOf("*") === val.length - 1) &&
                !(val[0] === "*" && val[val.length - 1] === "*")) {
                option = 1; // *string or string*
            } else {
                option = 2;
            }
            const newVal = this.splitString(val, option);
            const len = newVal.length;
            for (const i of data) {
                for (const obj of i) {
                    let target = obj[cmp];
                    if (cmp.includes("uuid")) {
                        target = target.toString();
                    }
                    if (this.cmpString(val, target, newVal, len, option, notIS)) {
                        const d: any = {};
                        for (const s of columns) {
                            this.updateDatum(d, obj, s);
                        }
                        aData.push(d);
                    }
                }
            }
        } else {
            return 0; // 0 means unsolved yet.
        }
        return this.sortFunction(aData, order);
    }

    private optTokens(opt: string, cmpVal: any, data: any, order: any, columns: any): any {
        // handle empty where
        if (opt === "EMPTY") {
            let retData: any = 0;
            for (const item of data) {
                const aData = item[0];
                if (Object.keys(aData)[0].split("_")[0] === datasetName) {
                    retData = item;
                }
            }
            // if (retData !== 0) {
            //     return this.sortFunction(retData, order);
            // }
            // return retData;
            return this.sortFunction(retData, order);
        }

        if ((typeof cmpVal === "number") || (typeof cmpVal === "string") || Object.keys(cmpVal).length === 0) {
            throw {code: 400, body: {error: "invalid query."}};
        }
        let d: any = [];
        const ds = this.operations(opt, cmpVal, data, order, columns, false);
        if (ds !== 0) {
            d = ds;
            return d;
        }
        if (opt === "AND" || opt === "OR") {
            let [categorizedCmpVal, hasCateA] = this.categorizeCompareItem(cmpVal);

            if (opt === "AND") {
                let count: number = 0;
                for (const item of categorizedCmpVal) {
                    let innerData: any = [];
                    if (count === 0 && hasCateA) {
                        innerData = this.getDataByMultiComparison(item, data, opt, columns);
                    } else if (count === 0) {
                        innerData =
                            this.optTokens(Object.keys(item)[0], item[Object.keys(item)[0]], data, order, columns);
                    } else {
                        innerData =
                            this.optTokens(Object.keys(item)[0], item[Object.keys(item)[0]], d, order, columns);
                    }
                    count++;
                    if (d.length === 0) {
                        d.push(innerData);
                    } else {
                        d[0] = innerData;
                    }
                }
                d = d[0];
            } else {
                let count: number = 0;
                for (const item of categorizedCmpVal) {
                    let innerData: any = [];
                    if (count === 0 && hasCateA) {
                        innerData =
                            this.getDataByMultiComparison(item, data, opt, columns);
                    } else {
                        innerData =
                            this.optTokens(Object.keys(item)[0], item[Object.keys(item)[0]], data, order, columns);
                    }
                    count++;
                    d.push(innerData);
                }
                if (d.length === 1) {
                    d = d[0];
                } else {
                    d = this.combineArrays(d);
                }
            }
        } else if (opt === "NOT") {
            /**
             * NOT is now for IS only due to the @WhereRebuilder
             */
            let notVal = Object.keys(cmpVal)[0];
            let notCmpVal = cmpVal[notVal];
            if (notVal === "IS") {
                d = this.operations(notVal, notCmpVal, data, order, columns, true);
            }
        }
        return this.sortFunction(d, order);
    }

    private categorizeCompareItem(data: any): any {
        let hasCateA = false;
        const cateA: any[] = [];
        const cateB: any[] = [];
        const final: any[] = [];
        for (const item of data) {
            let filter = Object.keys(item)[0];
            switch (filter) {
                case "GT":
                case "LT":
                case "EQ":
                    let filterVal = item[filter];
                    let cmpKey = Object.keys(filterVal)[0];
                    let cmpVal = filterVal[cmpKey];
                    this.verifyKeys(this.dataset, cmpKey, 0);
                    this.verifyValues(cmpKey, cmpVal);
                    cateA.push(item);
                    break;
                case "IS":
                case "AND":
                case "OR":
                case "NOT":
                    cateB.push(item);
                    break;
                default:
                    throw {code: 400, body: {error: "Invalid"}};
            }
        }
        if (cateA.length !== 0) {
            hasCateA = true;
            final.push(cateA);
        }
        if (cateB.length !== 0) {
            for (const item of cateB) {
                final.push(item);
            }
        }
        return [final, hasCateA];
    }

    private getDataByMultiComparison(cmp: any, data: any, option: any, columns: any): any {
        const result: any[] = [];
        for (const item of data[0]) {
            if (this.compareAll(item, cmp, option)) {
                const d: any = {};
                for (const s of columns) {
                    this.updateDatum(d, item, s);
                }
                result.push(d);
            }
        }
        return result;
    }

    private compareAll(data: any, cmp: any, option: string): boolean {
        let flag = false;
        for (const item of cmp) {
            let token = Object.keys(item)[0];
            let cmpObj = item[token];
            let cmpKey = Object.keys(cmpObj)[0];
            let cmpVal = cmpObj[cmpKey];
            if (this.helpGTLTEQ(data[cmpKey], cmpVal, token)) {
                flag = true;
                if (option === "OR") {
                    break;
                }
            } else {
                flag = false;
                if (option === "AND") {
                    break;
                }
            }
        }
        return flag;
    }

    private getTransformations(origin: any, group: any, apply: any, columns: any, order: any): any {
        const newDataset: any = [];
        const groupedDataset = this.groupUp(origin, group);
        const aDataset = this.applyGroup(groupedDataset, apply);
        for (const item of aDataset) {
            const aData: any = {};
            for (const col of columns) {
                aData[col] = item[col];
            }
            newDataset.push(aData);
        }
        return this.sortFunction(newDataset, order);
    }

    private updateResult(columns: any, data: any): any {
        const result: any[] = [];
        for (const d of data) {
            const aData: any = {};
            for (const item of columns) {
                aData[item] = d[item];
            }
            result.push(aData);
        }
        return result;
    }

    private updateDatum(target: any, origin: any, key: any): void {
        if (identifier.includes("uuid") && key === identifier) {
            target[key] = origin[key].toString();
        } else if (key.includes("year")) {
            target[key] = +origin[key];
        } else {
            target[key] = origin[key];
        }
    }

    private groupUp(data: any, group: any): any {
        const tempGroup: string[] = [];
        for (const item of group) {
            tempGroup.push(item);
        }
        const newData: any[] = [];
        const aGroup: string = tempGroup.shift();
        const groupMembers: any[] = [];
        for (const item of data) {
            const index: number = groupMembers.indexOf(item[aGroup]);
            if (index === -1) {
                groupMembers.push(item[aGroup]);
                const newGroup: any[] = [];
                newGroup.push(item);
                newData.push(newGroup);
            } else {
                newData[index].push(item);
            }
        }
        // will process below if there's multi-group.
        if (tempGroup.length > 0) {
            const innerDataset: any[] = [];
            for (const item of newData) {
                const innerData = this.groupUp(item, tempGroup);
                for (const innerItem of innerData) {
                    innerDataset.push(innerItem);
                }
            }
            return innerDataset;
        }
        return newData;
    }

    private applyGroup(data: any, apply: any): any {
        for (const aGroup of data) {
            for (const aApply of apply) {
                const applyKey = Object.keys(aApply)[0];
                const applyVal = aApply[applyKey];
                const applyToken = Object.keys(applyVal)[0];
                const targetVal = applyVal[applyToken];
                this.updateByApply(aGroup, applyKey, applyToken, targetVal);
            }
        }
        const newData: any[] = [];
        for (const item of data) {
            newData.push(item[0]);
        }
        return newData;
    }

    private updateByApply(data: any, target: any, token: any, key: any): void {
        let returnVal: any = 0;
        switch (token) {
            case "AVG":
                const avg: any = this.getSumOfData(data, key) / data.length;
                returnVal = Number(avg.toFixed(2));
                break;
            case "MAX":
                returnVal = data[0][key];
                for (const item of data) {
                    if (item[key] > returnVal) {
                        returnVal = item[key];
                    }
                }
                break;
            case "MIN":
                returnVal = data[0][key];
                for (const item of data) {
                    if (item[key] < returnVal) {
                        returnVal = item[key];
                    }
                }
                break;
            case "COUNT":
                const occurred: any[] = [];
                for (const item of data) {
                    const targetVal: any = item[key];
                    if (occurred.indexOf(targetVal) === -1) {
                        occurred.push(targetVal);
                    }
                }
                returnVal = occurred.length;
                break;
            case "SUM":
                returnVal = this.getSumOfData(data, key);
                break;
        }
        for (const item of data) {
            item[target] = returnVal;
        }
    }

    private getSumOfData(data: any, key: any): number {
        let sum: any = new Decimal(0);
        for (const item of data) {
            const toAdd: any = new Decimal(item[key]);
            sum = Decimal.add(sum, toAdd);
        }
        return sum.toNumber();
    }

    private remove(zipId: string): void {
        fs.unlink("cachedData/" + zipId + ".json", (err) => {
            if (err) {
                // there are actually no errors
            }
        });
    }

    private verifyKeys(datasets: any, key: string, extraData: any): any {
        if (extraData !== 0) {
            if (extraData.indexOf(key) !== -1) {
                return 200;
            } else {
                throw {code: 400, body: {error: "All COLUMNS keys need to be either in GROUP or in APPLY"}};
            }
        } else {
            const keys: any = key.split("_");
            if (keys.length === 2) {
                if (Object.keys(datasets).indexOf(keys[0]) !== -1) {
                    if (datasetName !== 0 && keys[0] !== datasetName) {
                        throw {code: 400, body: {error: "accessing two datasets at the same time"}};
                    } else if (datasetName === 0) {
                        datasetName = keys[0];
                    }
                    if (validKeysCourses.indexOf(keys[1]) !== -1 || validkeysRoom.indexOf(keys[1]) !== -1) {
                        return 200; // success
                    }
                } else {
                    // return 424; // invalid dataset
                    throw {code: 400, body: {error: "invalid dataset."}};
                }
            }
            // return 400; // invalid key
            throw {code: 400, body: {error: "invalid key"}};
        }
    }

    private verifyValues(key: any, value: any): any {
        const aKey: string = key.split("_")[1];
        let expectedType;
        switch (aKey) {
            case "dept":
            case "id":
            case "instructor":
            case "title":
            case "uuid":
            case "fullname":
            case "shortname":
            case "number":
            case "name":
            case "address":
            case "type":
            case "furniture":
            case "href":
                expectedType = "string";
                break;
            case "avg":
            case "pass":
            case "fail":
            case "audit":
            case "year":
            case "lat":
            case "lon":
            case "seats":
                expectedType = "number";
                break;
        }
        if (expectedType === typeof value) {
            return 200;
        } else {
            throw {code: 400, body: {error: "invalid value type."}};
        }
    }

    private verifyEBNF(options: any, ebnf: any): any {
        switch (ebnf) {
            case "INITIAL":
                if (Object.keys(options).length === 0) {
                    throw {code: 400, body: {error: "Query format is wrong"}};
                }
                if (!options.hasOwnProperty("WHERE") || !options.hasOwnProperty("OPTIONS")) {
                    throw {code: 400, body: {error: "Query format is wrong"}};
                }
                break;
            case "COLUMNS":
                if (!options.hasOwnProperty(ebnf)) {
                    throw {code: 400, body: {error: "IOptions format is wrong"}};
                } else if (options["COLUMNS"].length === 0) {
                    throw {code: 400, body: {error: "Columns cannot be empty"}};
                }
                break;
            case "ORDER":
                if (options.hasOwnProperty(ebnf)) {
                    if ((typeof options[ebnf]) === "string") {
                        if (options["COLUMNS"].indexOf(options[ebnf]) === -1) {
                            throw {code: 400, body: {error: "Order key needs to be included in columns"}};
                        }
                        return options[ebnf];
                    } else {
                        const allKeys = Object.keys(options[ebnf]);
                        const key = options[ebnf];
                        if (allKeys.indexOf("dir") === -1 || allKeys.indexOf("keys") === -1) {
                            throw {code: 400, body: {error: "Option order not valid"}};
                        }
                        if (!DIRECTION.includes(key.dir)) {
                            throw {code: 400, body: {error: "Order direction not valid"}};
                        }
                        if (!Array.isArray(key.keys) || key.keys.length === 0) {
                            throw {code: 400, body: {error: "Option order invalid"}};
                        }
                        const newOrder: string[] = [];
                        newOrder.push(key.dir);
                        for (const order of key.keys) {
                            newOrder.push(order);
                        }
                        return newOrder;
                    }
                }
                break;
            case "TRANSFORMATIONS":
                if (options.hasOwnProperty(ebnf)) {
                    if (options[ebnf].hasOwnProperty("GROUP") && options[ebnf].hasOwnProperty("APPLY")) {
                        // return true;
                        const transformations: any = options["TRANSFORMATIONS"];
                        let transformationsKeys = this.verifyEBNF(transformations, "APPLY");
                        transformationsKeys = transformationsKeys.concat(this.verifyEBNF(transformations, "GROUP"));
                        const group = options["TRANSFORMATIONS"].GROUP;
                        const apply = options["TRANSFORMATIONS"].APPLY;
                        return [transformationsKeys, group, apply];
                    } else {
                        throw {code: 400, body: {error: "Transformations needs to contains both GROUP and APPLY"}};
                    }
                } else {
                    return [0, "", ""];
                    // return false;
                }
            case "APPLY":
                const applyKeys = options[ebnf];
                const returnKeys: any = [];
                if (Array.isArray(applyKeys)) {
                    const occurredKey: any[] = [];
                    for (const item of applyKeys) {
                        const itemKey: string = Object.keys(item)[0];
                        if (itemKey.includes("_")) {
                            throw {code: 400, body: {error: "Apply keys cannot contain '_'"}};
                        }
                        if (occurredKey.indexOf(itemKey) !== -1) {
                            throw {code: 400, body: {error: "Duplicate apply keys."}};
                        }
                        const obj = item[itemKey];
                        const objKey: string = Object.keys(obj)[0];
                        if (APPLYTOKEN.indexOf(objKey) === -1) {
                            throw {code: 400, body: {error: "Apply token not recognized"}};
                        }
                        const objVal = obj[objKey];
                        this.verifyKeys(this.dataset, objVal, 0);
                        if (objKey === "MAX" || objKey === "MIN" || objKey === "AVG") {
                            this.verifyValues(objVal, 1);
                        }
                        occurredKey.push(itemKey);
                        returnKeys.push(itemKey);
                    }
                    return returnKeys;
                }
                break;
                // throw {code: 4000, body: null};
            case "GROUP":
                const groupKeys = options[ebnf];
                const keysFromApply = this.verifyEBNF(options, "APPLY");
                let flag: boolean = false;
                if (Array.isArray(groupKeys)) {
                    for (const item of groupKeys) {
                        try {
                            if (this.verifyKeys(this.dataset, item, keysFromApply) === 200) {
                                flag = true;
                                break;
                            }
                        } catch (err) {
                            // do nothing
                        }
                        this.verifyKeys(this.dataset, item, 0);
                    }
                    if (flag) {
                        throw {code: 400, body: {error: "Group cannot contain apply keys"}};
                    }
                    return groupKeys;
                }
            //     throw {code: 400000, body: {error: "should not reach here"}};
            // default:
            //     break;
        }
        return "";
    }

    private pickDataset(original: any, name: string): any {
        const newDataset: any = [];
        const colsKeys: any = [];
        let kind: InsightDatasetKind;
        let option: number = 0;
        let i: any;
        for (const v of Object.keys(original)) {
            i = this.dataset[v];
            if (Array.isArray(i)) {
                const aData = i[0];
                for (const key of Object.keys(aData)) {
                    if (key.includes("_")) {
                        if (key.split("_")[0] === name) {
                            newDataset.push(i);
                            break;
                        } else {
                            break;
                        }
                    }
                }
            }
        }
        if (Object.keys(newDataset[0][0]).indexOf(datasetName + "_uuid") === -1) {
            kind = InsightDatasetKind.Rooms;
            option = 1;
        } else {
            kind = InsightDatasetKind.Courses;
            option = 0;
        }
        for (const item of validKeysKind[option]) {
            colsKeys.push(datasetName + "_" + item);
        }
        return [newDataset, colsKeys, kind];
    }

    private getIdentifier(kind: InsightDatasetKind): string {
        let checker: string = "";
        switch (kind) {
            case InsightDatasetKind.Courses:
                checker = datasetName + "_uuid";
                break;
            case InsightDatasetKind.Rooms:
                checker = datasetName + "_name";
                break;
            // default:
            //     break;
        }
        return checker;
    }

    private combineArrays(data: any): any {
        let newData: any = data[0];
        let count = 0;
        for (const ds of data) {
            if (count === 0) {
                count++;
                continue;
            }
            for (const d of ds) {
                let existed = false;
                for (const nd of newData) {
                    if (nd[identifier] === d[identifier]) {
                        existed = true;
                        break;
                    }
                }
                if (!existed) {
                    newData.push(d);
                }
            }
        }
        return newData;
    }

    private helpGTLTEQ(cmpVal: any, val: any, token: any): boolean {
        let flag: boolean = false;
        switch (token) {
            case "GT":
                if (cmpVal > val) {
                    flag = true;
                }
                break;
            case "LT":
                if (cmpVal < val) {
                    flag = true;
                }
                break;
            default:
                if (cmpVal === val) {
                    flag = true;
                }
                break;
        }
        return flag;
    }

    private splitString(val: any, option: number): string {
        let newVal;
        if (option === 1) {
            if (val[0] === "*") {
                newVal = val.split("*")[1];
            } else {
                newVal = val.split("*")[0];
            }
        } else if (option === 2) {
            if (!val.includes("*")) {
                newVal = val;
            } else {
                if (val.length === 1 && val === "*") {
                    newVal = "";
                } else if (val.includes("*")) {
                    newVal = val.split("*")[1];
                }
            }
        }
        return newVal;
    }

    private cmpString(origin: any, cmpVal: any, val: any, len: number, option: number, isNot: boolean): boolean {
        let flag: boolean = false;
        // if (typeof cmpVal === "undefined") {
        //     return flag;
        // }
        if (option === 1) {
            if (origin[0] === "*") {
                flag = cmpVal.substring((cmpVal).length - len).includes(val);
            } else {
                flag = cmpVal.substring(0, len).includes(val);
            }
        } else if (option === 2) {
            if (!origin.includes("*")) {
                flag = (cmpVal === val);
            } else {
                flag = cmpVal.includes(val);
            }
        }
        if (isNot) {
            flag = !flag;
        }
        return flag;
    }

    private sortFunction(data: any, order: any): any {
        if (!Array.isArray(order)) {
            return this.mergeSort(data, order, "UP");
        } else {
            let count: number = 1;
            let dir: any = 0;
            const newOrder: string[] = [];
            for (const item of order) {
                if (count === 1) {
                    dir = item;
                } else {
                    newOrder.push(item);
                }
                count++;
            }
            // if (DIRECTION.indexOf(dir) === -1) {
            //     throw {code: 400, body: {error: "Order direction not valid"}};
            // }
            let newData: any = 0;
            count = 1;
            while (newOrder.length > 0) {
                const cmpKey: string = newOrder.pop();
                if (count === 1) {
                    newData = this.mergeSort(data, cmpKey, dir);
                } else {
                    newData = this.mergeSort(newData, cmpKey, dir);
                }
                count++;
            }
            return newData;
        }
    }

    private mergeSort(data: any, cmpKey: string, dir: any): any {
        const len: number = data.length;
        const mid: number = Math.ceil(len / 2);
        let lo = data.slice(0, mid);
        let hi = data.slice(mid);
        if (mid > 1) {
            lo = this.mergeSort(lo, cmpKey, dir);
            hi = this.mergeSort(hi, cmpKey, dir);
        }
        return this.mergeSortHelper(lo, hi, cmpKey, dir);
    }

    private mergeSortHelper(lo: any, hi: any, cmpKey: string, dir: any): any {
        const data: any[] = [];
        let loIndex: number = 0;
        let hiIndex: number = 0;
        const loLen: number = lo.length;
        const hiLen: number = hi.length;
        let loData: any;
        let hiData: any;
        while (loIndex < loLen || hiIndex < hiLen) {
            loData = lo[loIndex];
            hiData = hi[hiIndex];
            if (typeof loData !== "undefined") {
                if (typeof hiData === "undefined") {
                    data.push(loData);
                    loIndex++;
                } else {
                    if (this.compareValueForSort(loData, hiData, cmpKey, dir)) {
                        data.push(loData);
                        loIndex++;
                    } else {
                        data.push(hiData);
                        hiIndex++;
                    }
                }
            } else {
                if (typeof hiData !== "undefined") {
                    data.push(hiData);
                    hiIndex++;
                }
            }
        }
        return data;
    }

    private compareValueForSort(a: any, b: any, cmpKey: string, dir: string): boolean {
        let flag: boolean = false;
        if (dir === "UP") {
            if (a[cmpKey] <= b[cmpKey]) {
                flag = true;
            }
        } else {
            if (a[cmpKey] >= b[cmpKey]) {
                flag = true;
            }
        }
        return flag;
    }
}
