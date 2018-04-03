import Log from "../Util";
import {InsightDatasetKind, InsightResponse} from "./IInsightFacade";
import fs = require("fs");
import * as JSZip from "jszip";
import * as parse5 from "parse5";
import * as http from "http";

export default class DataSetHelper {
    private filePathForRooms: any;
    private locations: {[address: string]: any};
    private allAddress: string[];

    constructor() {
        Log.trace("DataSetHelper::init()");
        this.locations = {};
        this.allAddress = [];
    }

    public addDataSetHelper(id: string, content: string, kind: InsightDatasetKind): Promise<InsightResponse> {
        const curZip = new JSZip();
        return curZip.loadAsync(content, {base64: true})
            .then((resultZip: any) => {
                const promises: any = [];
                try {
                    if (kind === InsightDatasetKind.Courses) {
                        resultZip.folder(kind).forEach((relativePath: any, file: any) => {
                            if (file.dir === false) {
                                promises.push(file.async("string"));
                            }
                        });
                    } else if (kind === InsightDatasetKind.Rooms) {
                        this.filePathForRooms = [];
                        resultZip.forEach((relativePath: any, file: any) => {
                            if (file.dir === false && !file.name.includes(".DS_Store")) {
                                this.filePathForRooms.push("./" + relativePath);
                                promises.push(file.async("string"));
                            }
                        });
                    } else {
                        throw new Error("Provided DatasetKind is Not supported!");
                    }
                } catch (err) {
                    throw new Error("Error in addDatasetHelper's loadAsync");
                    // return Promise.reject({code: 400, body: {error: err}});
                }
                return Promise.all(promises);
            })
            .then((resultZip: any) => {
                if (kind === InsightDatasetKind.Courses) {
                    return this.processEachJSON(resultZip, id);
                } else {
                    return this.processEachHTML(resultZip, id);
                }
            })
            .then((resultDataSet: any) => {
                if (kind === InsightDatasetKind.Rooms) {
                    return this.updateGeoLocation(resultDataSet, id);
                } else {
                    return resultDataSet;
                }
            })
            .then((resultDataSet: any) => {
                if (kind === InsightDatasetKind.Rooms) {
                    // return this.addGeoLocation(resultDataSet, id);
                    this.updateRoomsGeoLocation(resultDataSet, id);
                    return resultDataSet;
                } else {
                    return resultDataSet;
                }
            })
            // .then((resultDataSet: any) => {
            //     if (kind === InsightDatasetKind.Rooms) {
            //         return this.addGeoLocation(resultDataSet, id);
            //     } else {
            //         return resultDataSet;
            //     }
            // })
            .then((resultDataSet: any) => {
                return this.save(id, resultDataSet);
            });
    }

    private processEachJSON(zip: any, id: string): any {
        const curDataset: any = [];
        for (const course of zip) {
            let courseObj: any;
            try {
                courseObj = JSON.parse(course).result;
                for (const section of courseObj) {
                    const curSection: any = {};
                    curSection[id + "_dept"] = section.Subject;
                    curSection[id + "_id"] = section.Course;
                    curSection[id + "_avg"] = section.Avg;
                    curSection[id + "_instructor"] = section.Professor;
                    curSection[id + "_title"] = section.Title;
                    curSection[id + "_pass"] = section.Pass;
                    curSection[id + "_fail"] = section.Fail;
                    curSection[id + "_audit"] = section.Audit;
                    curSection[id + "_uuid"] = section.id;
                    if (section.Section === "overall") {
                        curSection[id + "_year"] = 1900;
                    } else {
                        curSection[id + "_year"] = +section.Year;
                    }
                    curDataset.push(curSection);
                }
            } catch (err) {
                Log.warn("invalid JSON file!");
            }
        }
        if (!curDataset.length) {
            throw new Error("error when processing courses: no section!");
            // return Promise.reject({code: 400, body: {error: "no section error"}});
        }
        // this.dataset[id] = curDataset;
        return curDataset;
    }

    private processEachHTML(zip: any, id: string): any {
        // parse index.htm
        const indexHTM: any = zip[zip.length - 1];
        const openTag: any = indexHTM.indexOf("<tbody>");
        const closeTag: any = indexHTM.indexOf("</tbody>");
        const tbody: any = indexHTM.slice(openTag, closeTag);
        const allBuildings: any = parse5.parseFragment(tbody);
        // const allBuildings: any = parse5.parseFragment(tbody) as parse5.AST.Default.DocumentFragment;;

        let allRooms: any = [];
        for (const building of allBuildings.childNodes[0].childNodes) {
            try {
                if (building.nodeName === "tr") {
                    const buildingInfo: any = {};
                    for (const eachInfo of building.childNodes) {
                        if (eachInfo.nodeName === "td") {
                            if (eachInfo.attrs[0].value === "views-field views-field-field-building-code") {
                                // getting building code
                                const rawBuildingCode: any = eachInfo.childNodes[0].value;
                                buildingInfo.shortname = this.getOrgnzedString(rawBuildingCode);
                            } else if (eachInfo.attrs[0].value === "views-field views-field-title") {
                                // getting building full name
                                buildingInfo.fullname = eachInfo.childNodes[1].childNodes[0].value;
                            } else if (eachInfo.attrs[0].value === "views-field views-field-field-building-address") {
                                // getting building address
                                const rawAddress: any = eachInfo.childNodes[0].value;
                                const address: any = this.getOrgnzedString(rawAddress);
                                buildingInfo.address = address;
                                if (!this.allAddress.includes(address)) {
                                    this.allAddress.push(address);
                                }
                            } else if (eachInfo.attrs[0].value === "views-field views-field-nothing") {
                                const path: any = eachInfo.childNodes[1].attrs[0].value;
                                const pathIndex: number = this.filePathForRooms.indexOf(path);
                                // check if we have path for this room;
                                // parse the room if we do, otherwise, skip this room
                                // NOTE: put this here because usually the room would be linked to index.htm
                                if (pathIndex !== -1) {
                                    buildingInfo.href = "http://students.ubc.ca" + path.substring(1);
                                    // TODO: MOVE HREF TO parseRoom!
                                    const rooms: any[] = this.parseRoom(zip[pathIndex], buildingInfo, id);
                                    allRooms = allRooms.concat(rooms);
                                } else {
                                    throw new Error("this room is not linked.");
                                }
                            }
                        }
                    }
                }
            } catch (err) {
                Log.warn(err);
            }
        }
        return allRooms;
    }

    private parseRoom(building: any, buildingInfo: any, id: any): any[] {
        const openTag: any = building.indexOf("<tbody>");
        if (openTag === -1) {
            return [];
        }
        const closeTag: any = building.indexOf("</tbody>");
        const tbody: any = building.slice(openTag, closeTag);
        const allRooms: any = parse5.parseFragment(tbody);

        const roomsOfBuilding: any[] = [];

        for (const rooms of allRooms.childNodes[0].childNodes) {
            if (rooms.nodeName === "tr") {
                const aRoom: any = {};
                for (const eachInfo of rooms.childNodes) {
                    if (eachInfo.nodeName === "td") {
                        if (eachInfo.attrs[0].value === "views-field views-field-field-room-number") {
                            // define room's number & href
                            aRoom[id + "_href"] = eachInfo.childNodes[1].attrs[0].value;
                            aRoom[id + "_number"] = eachInfo.childNodes[1].childNodes[0].value;
                        } else if (eachInfo.attrs[0].value === "views-field views-field-field-room-capacity") {
                            // "+" in front of string turns string to number
                            aRoom[id + "_seats"] = +this.getOrgnzedString(eachInfo.childNodes[0].value);
                        } else if (eachInfo.attrs[0].value === "views-field views-field-field-room-furniture") {
                            aRoom[id + "_furniture"] = this.getOrgnzedString(eachInfo.childNodes[0].value);
                        } else if (eachInfo.attrs[0].value === "views-field views-field-field-room-type") {
                            aRoom[id + "_type"] = this.getOrgnzedString(eachInfo.childNodes[0].value);
                        }
                    }
                }
                aRoom[id + "_fullname"] = buildingInfo.fullname;
                aRoom[id + "_shortname"] = buildingInfo.shortname;
                // aRoom[id + "_name"] = buildingInfo.fullname + "_" + buildingInfo.rooms_shortname;
                aRoom[id + "_name"] = buildingInfo.shortname + "_" + aRoom[id + "_number"];
                aRoom[id + "_address"] = buildingInfo.address;
                aRoom[id + "_lat"] = buildingInfo.lat;
                aRoom[id + "_lon"] = buildingInfo.lon;
                roomsOfBuilding.push(aRoom);
            }
        }
        return roomsOfBuilding;
    }

    // Update geoLocation for address
    private updateGeoLocation(resultDataSet: any, id: any): any {
        const promises: any[] = [];
        // let address: any;
        // for (const aRoom of resultDataSet) {
        //     address = aRoom[id + "_address"];
        //     if (!this.allAddress.includes(address)) {
        //         this.allAddress.push(address);
        //         promises.push(this.getGeoLocation(address));
        //     }
        // }
        for (const address of this.allAddress) {
            promises.push(this.getGeoLocation(address));
        }
        return Promise.all(promises).then(() => {
            return resultDataSet;
        });
    }

    private getGeoLocation(address: any): any {
        const url: any = this.getURL(address);
        return new Promise(((resolve, reject) => {
            http.get(url, (res) => {
                res.setEncoding("utf8");
                let body = "";
                res.on("data", (data) => {
                    body += data;
                });
                res.on("end", () => {
                    const parsedBody: any = JSON.parse(body);
                    this.locations[address] = [parsedBody.lat, parsedBody.lon];
                    resolve(1);
                });
            });
        }));
    }

    private updateRoomsGeoLocation(data: any, id: any): void {
        for (const room of data) {
            const address = room[id + "_address"];
            const [lat, lon] = this.locations[address];
            room[id + "_lat"] = lat;
            room[id + "_lon"] = lon;
        }
    }

    private getOrgnzedString(rawString: string): string {
        const startIdx = rawString.indexOf("\n");
        return rawString.slice(startIdx).trim();
    }

    private getURL(address: any): any {
        const splitedAddress: any[] = address.split(" ");
        const urlOfAddress: any = splitedAddress.join("%20");
        return "http://skaha.cs.ubc.ca:11316/api/v1/team42/" + urlOfAddress;
    }

    // private addGeoLocation(resultDataSet: any, id: any): any {
    //     const promises: any[] = [];
    //     for (const aRoom of resultDataSet) {
    //         const url: any = this.getURL(aRoom[id + "_address"]);
    //         promises.push(this.asyncAddLatLon(aRoom, url, id));
    //     }
    //     return Promise.all(promises);
    // }
    //
    // private asyncAddLatLon(room: any, url: any, id: any): Promise<any> {
    //     return new Promise(((resolve, reject) => {
    //         http.get(url, (res) => {
    //             res.setEncoding("utf8");
    //             let body = "";
    //             res.on("data", (data) => {
    //                 body += data;
    //             });
    //             res.on("end", () => {
    //                 const parsedBody: any = JSON.parse(body);
    //                 room[id + "_lat"] = parsedBody.lat;
    //                 room[id + "_lon"] = parsedBody.lon;
    //                 resolve(room);
    //             });
    //         });
    //     }));
    // }

    private save(zipId: string, content: any): any {
        if (!fs.existsSync("cachedData/")) {
            fs.mkdirSync("cachedData/");
        }
        const toSave: string = JSON.stringify(content);
        fs.writeFile("cachedData/" + zipId + ".json", toSave, function (err) {
            if (err) {
                throw err;
            }
        });
        return content;
    }

}
