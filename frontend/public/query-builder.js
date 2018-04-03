/**
 * Builds a query object using the current document object model (DOM).
 * Must use the browser's global document object {@link https://developer.mozilla.org/en-US/docs/Web/API/Document}
 * to read DOM information.
 *
 * @returns query object adhering to the query EBNF
 */
CampusExplorer.buildQuery = function() {
    // TODO: refactor functions
    function getOption(name) {
        let option = -1;
        switch (name.split(" ")[1]) {
            case "conditions":
                option = "WHERE";
                break;
            case "columns":
                option = "COLUMNS";
                break;
            case "order":
                option = "ORDER";
                break;
            case "groups":
                option = "GROUP";
                break;
            case "transformations":
                option = "APPLY";
                break;
            default:
                break;
        }
        return option;
    }

    function buildQueryParts(option, data, kind) {
        let returnItem;
        switch (option) {
            case "WHERE": // conditions;
                returnItem = getWhere(data, kind);
                break;
            case "COLUMNS": // columns;
                returnItem = getGroupsOrColumns(data, kind);
                break;
            case "ORDER": // order;
                returnItem = getOrder(data, kind);
                break;
            case "GROUP": // groups;
                returnItem = getGroupsOrColumns(data, kind);
                break;
            case "APPLY": // apply (transformations);
                returnItem = getApply(data, kind);
                break;
            default:
                returnItem = 0;
                break;
        }
        return returnItem;
    }

    function getWhere(data, kind) {
        let globalCondition = getGlobal(data.getElementsByClassName("control-group condition-type")[0]);
        let tokens = getConditions(data.getElementsByClassName("conditions-container")[0]
            .getElementsByClassName("control-group condition"), kind);
        let where = {};
        switch (globalCondition) {
            case "all":
                where = getWhereAllOrAny(tokens, "AND");
                break;
            case "any":
                where = getWhereAllOrAny(tokens, "OR");
                break;
            case "none":
                where["NOT"] = getWhereAllOrAny(tokens, "OR");
                break;
            default:
                where = getWhereAllOrAny(tokens, "AND");
                break;
        }
        return where;
    }

    function getGlobal(data) {
        let condition = "";
        for (const item of data.children) {
            let input = item.getElementsByTagName("input")[0];
            if (input.hasAttribute("checked") && input.getAttribute("checked") === "checked") {
                condition = input.getAttribute("value");
                break;
            }
        }
        return condition;
    }

    function getConditions(data, kind) {
        let conditions = [];
        for (const item of data) {
            let isNot = false;
            let key;
            let operator;
            let value;
            let keyVal = {};
            let condition = {};
            for (const part of item.children) {
                switch (part.className) {
                    case "control not":
                        let inputNot = part.getElementsByTagName("input")[0];
                        if (inputNot.hasAttribute("checked") && inputNot.getAttribute("checked") === "checked") {
                            isNot = true;
                        }
                        break;
                    case "control fields":
                        key = getSelect(part, kind)[0];
                        break;
                    case "control operators":
                        operator = getSelect(part, "operator")[0];
                        break;
                    case "control term":
                        let inputVal = part.getElementsByTagName("input")[0];
                        value = inputVal.getAttribute("value");
                        if (!isNaN(value) && isNumericKey(key)) {
                            value = +value;
                        }
                        break;
                    default:
                        break;
                }
            }
            keyVal[key] = value;
            condition[operator] = keyVal;
            if (isNot) {
                let notCondition = {};
                notCondition["NOT"] = condition;
                conditions.push(notCondition);
            } else {
                conditions.push(condition);
            }
        }
        return conditions;
    }

    function isNumericKey(key) {
        let result = false;
        let aKey = key.split("_")[1];
        switch (aKey) {
            case "avg":
            case "pass":
            case "fail":
            case "audit":
            case "year":
            case "lat":
            case "lon":
            case "seats":
                result = true;
                break;
            default:
                break;
        }
        return result;
    }

    function isOriginalKey(key) {
        let result = false;
        switch (key) {
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
            case "avg":
            case "pass":
            case "fail":
            case "audit":
            case "year":
            case "lat":
            case "lon":
            case "seats":
                result = true;
                break;
            default:
                break;
        }
        return result;
    }

    function getWhereAllOrAny(data, option) {
        if (data.length === 1) {
            return data[0];
        } else if (data.length === 0) {
            return {};
        }
        let retToken = {};
        retToken[option] = data;
        return retToken;

    }

    function getOrder(data, kind) {
        let dir = "UP";
        let keys = [];
        let elements = data.getElementsByClassName("control-group")[0]
            .getElementsByTagName("div");
        for (const item of elements) {
            if (item.className === "control order fields") {
                keys = getSelect(item, kind);
            } else if (item.className === "control descending") {
                let input = item.getElementsByTagName("input")[0];
                if (input.hasAttribute("checked") && input.getAttribute("checked") === "checked") {
                    dir = "DOWN";
                }
            }
        }
        let returnItem = {};
        returnItem["dir"] = dir;
        returnItem["keys"] = keys;
        if (keys.length === 1 && dir === "UP") {
            return keys[0];
        } else if (keys.length === 0) {
            return 0;
        }
        return returnItem;
    }

    function getGroupsOrColumns(data, kind) {
        let result = [];
        let elements = data.getElementsByClassName("control-group")[0]
            .getElementsByTagName("div");
        for (const item of elements) {
            let input = item.getElementsByTagName("input")[0];
            if (input.hasAttribute("checked") && input.getAttribute("checked") === "checked") {
                let value = input.getAttribute("value");
                if (!isOriginalKey(value)) {
                    result.push(value);
                } else {
                    let aKey = kind + "_" + value;
                    result.push(aKey);
                }
            }
        }
        return result;
    }

    function getApply(data, kind) {
        let apply = [];
        let elements = data.getElementsByClassName("transformations-container")[0]
            .getElementsByClassName("control-group transformation");
        for (const item of elements) {
            let divs = item.getElementsByTagName("div");
            let applyString;
            let applyToken;
            let key;
            for (const obj of divs) {
                switch (obj.className) {
                    case "control term":
                        applyString = obj.getElementsByTagName("input")[0].getAttribute("value");
                        break;
                    case "control operators":
                        applyToken = getSelect(obj, "operator")[0];
                        break;
                    case "control fields":
                        key = getSelect(obj, kind)[0];
                        break;
                    default:
                        break;
                }
            }
            let applyInner = {};
            applyInner[applyToken] = key;
            let applyKey = {};
            applyKey[applyString] = applyInner;
            apply.push(applyKey);
        }
        return apply;
    }

    function getSelect(data, kind) {
        let result = [];
        let options = data.getElementsByTagName("select")[0].getElementsByTagName("option");
        for (const option of options) {
            if (option.hasAttribute("selected") && option.getAttribute("selected") === "selected") {
                let value = option.getAttribute("value");
                if (kind !== "operator" && isOriginalKey(value)) {
                    value = kind + "_" + value;
                }
                result.push(value);
            }
        }
        return result;
    }

    function finalBuild(query) {
        let result = {};
        result["WHERE"] = query["WHERE"];
        let options = {};
        options["COLUMNS"] = query["COLUMNS"];
        if (query["ORDER"] !== 0) {
            options["ORDER"] = query["ORDER"];
        }
        // options["FORM"] = "TABLE";
        result["OPTIONS"] = options;
        if (query["GROUP"].length > 0) {
            let transformations = {};
            transformations["GROUP"] = query["GROUP"];
            transformations["APPLY"] = query["APPLY"];
            result["TRANSFORMATIONS"] = transformations;
        }
        return result;
    }

    let queryToken = {};
    let raw = document.getElementsByClassName("tab-panel active")[0];
    let kind = raw.getAttribute("data-type");
    let queryEBNF = raw.children[0].children;
    for (const item of queryEBNF) {
        let option = getOption(item.className);
        if (option === -1) {
            // TODO: handle Exception?
        }
        queryToken[option] = buildQueryParts(option, item, kind);
    }

    // TODO: raw function above, need to refactor
    let query = finalBuild(queryToken);
    return query;
};
