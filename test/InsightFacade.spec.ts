import {expect} from "chai";

import {InsightDatasetKind, InsightResponse,
    InsightResponseErrorBody, InsightResponseSuccessBody} from "../src/controller/IInsightFacade";
import InsightFacade from "../src/controller/InsightFacade";
import Log from "../src/Util";
import TestUtil from "./TestUtil";
import WhereRebuilder from "../src/controller/WhereRebuilder";

// This should match the JSON schema described in test/query.schema.json
// except 'filename' which is injected when the file is read.
export interface ITestQuery {
    title: string;
    query: any;  // make any to allow testing structurally invalid queries
    response: InsightResponse;
    filename: string;  // This is injected when reading the file
}

describe("InsightFacade Add/Remove Dataset", function () {
    // Reference any datasets you've added to test/data here and they will
    // automatically be loaded in the Before All hook.
    const datasetsToLoad: { [id: string]: string } = {
        cCourses: "./test/data/corrupt.zip",
        courses: "./test/data/courses.zip",
        emResult: "./test/data/emR.zip",
        empty: "./test/data/empty.zip",
        infCourses: "./test/data/infCourses.zip",
        jCourses: "./test/data/courses.json",
        noSection: "./test/data/noSection.zip",
        nullInData: "./test/data/NULLINDATA.zip",
        oneSection: "./test/data/oneSection.zip",
        ovoin: "./test/data/ovoin.zip",
        ovot: "./test/data/ovot.zip",
        rooms: "./test/data/rooms.zip",
        tCourses: "./test/data/textFormat.zip",
    };

    let insightFacade: InsightFacade;
    let datasets: { [id: string]: string };

    before(async function () {
        Log.test(`Before: ${this.test.parent.title}`);

        try {
            const loadDatasetPromises: Array<Promise<Buffer>> = [];
            for (const [id, path] of Object.entries(datasetsToLoad)) {
                loadDatasetPromises.push(TestUtil.readFileAsync(path));
            }
            const loadedDatasets = (await Promise.all(loadDatasetPromises)).map((buf, i) => {
                return {[Object.keys(datasetsToLoad)[i]]: buf.toString("base64")};
            });
            datasets = Object.assign({}, ...loadedDatasets);
            expect(Object.keys(datasets)).to.have.length.greaterThan(0);
        } catch (err) {
            expect.fail("", "", `Failed to read one or more datasets. ${JSON.stringify(err)}`);
        }

        try {
            insightFacade = new InsightFacade();
        } catch (err) {
            Log.error(err);
        } finally {
            expect(insightFacade).to.be.instanceOf(InsightFacade);
        }
    });

    beforeEach(function () {
        Log.test(`BeforeTest: ${this.currentTest.title}`);
    });

    after(function () {
        Log.test(`After: ${this.test.parent.title}`);
    });

    afterEach(function () {
        Log.test(`AfterTest: ${this.currentTest.title}`);
    });

    it("Should add a valid dataset", async () => {
        const id: string = "courses";
        const expectedCode: number = 204;
        let response: InsightResponse;

        try {
            response = await insightFacade.addDataset(id, datasets[id], InsightDatasetKind.Courses);
        } catch (err) {
            response = err;
        } finally {
            expect(response.code).to.equal(expectedCode);
        }
    });

    it("Should add a valid dataset, rooms", async () => {
        const id: string = "rooms";
        const expectedCode: number = 204;
        let response: InsightResponse;

        try {
            response = await insightFacade.addDataset(id, datasets[id], InsightDatasetKind.Rooms);
        } catch (err) {
            response = err;
        } finally {
            expect(response.code).to.equal(expectedCode);
        }
    });

    // Operation failed id does not exist
    it("Operation failed, id does not exist", async () => {
        const id: string = "CPSC4400";
        const expectedCode: number = 400;
        let response3: InsightResponse;
        try {
            response3 = await insightFacade.addDataset(id, datasets[id], InsightDatasetKind.Courses);
        } catch (err) {
            response3 = err;
        } finally {
            expect(response3.code).to.equal(expectedCode);
            expect(response3.body).to.have.property("error");
            expect(typeof((response3.body as InsightResponseErrorBody).error)).to.equal(typeof(""));
        }
    });

    it("should remove the dataset", async () => {
        const id: string = "courses";
        const expectedCode: number = 204;
        let response4: InsightResponse;
        try {
            response4 = await insightFacade.removeDataset(id);
        } catch (err) {
            response4 = err;
        } finally {
            expect(response4.code).to.equal(expectedCode);
        }
    });

    it("Failed to remove the course dataset", async () => {
        const id: string = "courses";
        const expectedCode: number = 404;
        let response5: InsightResponse;
        try {
            response5 = await insightFacade.removeDataset(id);
        } catch (err) {
            response5 = err;
        } finally {
            expect(response5.code).to.equal(expectedCode);
            expect(response5.body).to.have.property("error");
            expect(typeof((response5.body as InsightResponseErrorBody).error)).to.equal(typeof(""));
        }
    });

    it("Should add a valid dataset (restart)", async () => {
        const id: string = "courses";
        const expectedCode: number = 204;
        let response: InsightResponse;

        try {
            response = await insightFacade.addDataset(id, datasets[id], InsightDatasetKind.Courses);
        } catch (err) {
            response = err;
        } finally {
            expect(response.code).to.equal(expectedCode);
        }
    });

    // Add already existed course dataset
    it("Add already existed dataset", async () => {
        const id: string = "courses";
        const expectedCode: number = 400;
        let response2: InsightResponse;
        try {
            response2 = await insightFacade.addDataset(id, datasets[id], InsightDatasetKind.Courses);
        } catch (err) {
            response2 = err;
        } finally {
            expect(response2.code).to.equal(expectedCode);
            expect(response2.body).to.have.property("error");
            expect(typeof((response2.body as InsightResponseErrorBody).error)).to.equal(typeof(""));
        }
    });

    // invalid dataset, not zip, 400
    it("Fail to add invalid dataset form", async () => {
        const id: string = "jCourses";
        const expectedCode: number = 400;
        let response: InsightResponse;
        try {
            response = await insightFacade.addDataset(id, datasets[id], InsightDatasetKind.Courses);
        } catch (err) {
            response = err;
        } finally {
            expect(response.code).to.equal(expectedCode);
            expect(response.body).to.have.property("error");
            expect(typeof((response.body as InsightResponseErrorBody).error)).to.equal(typeof(""));
        }
    });

    // corrupted zip, 400
    it("Fail to add corrupted zip", async () => {
        const id: string = "cCourses";
        const expectedCode: number = 400;
        let response: InsightResponse;
        try {
            response = await insightFacade.addDataset(id, datasets[id], InsightDatasetKind.Courses);
        } catch (err) {
            response = err;
        } finally {
            expect(response.code).to.equal(expectedCode);
            expect(response.body).to.have.property("error");
            expect(typeof((response.body as InsightResponseErrorBody).error)).to.equal(typeof(""));
        }
    });

    // zip with no data, 400
    it("Fail to add empty zip", async () => {
        const id: string = "empty";
        const expectedCode: number = 400;
        let response: InsightResponse;
        try {
            response = await insightFacade.addDataset(id, datasets[id], InsightDatasetKind.Courses);
        } catch (err) {
            response = err;
        } finally {
            expect(response.code).to.equal(expectedCode);
            expect(response.body).to.have.property("error");
            expect(typeof((response.body as InsightResponseErrorBody).error)).to.equal(typeof(""));
        }
    });

    // null id, 400
    it("Fail to add null", async () => {
        const id: string = null;
        const expectedCode: number = 400;
        let response: InsightResponse;
        try {
            response = await insightFacade.addDataset(id, datasets[id], InsightDatasetKind.Courses);
        } catch (err) {
            response = err;
        } finally {
            expect(response.code).to.equal(expectedCode);
            expect(response.body).to.have.property("error");
            expect(typeof((response.body as InsightResponseErrorBody).error)).to.equal(typeof(""));
        }
    });

    // add dataset with NULL data in file, 400
    it("Fail to add dataset with null data course", async () => {
        const id: string = "nullInData";
        const expectedCode: number = 400;
        let response: InsightResponse;
        try {
            response = await insightFacade.addDataset(id, datasets[id], InsightDatasetKind.Courses);
        } catch (err) {
            response = err;
        } finally {
            expect(response.code).to.equal(expectedCode);
            expect(response.body).to.have.property("error");
            expect(typeof((response.body as InsightResponseErrorBody).error)).to.equal(typeof(""));
        }
    });

    // add dataset with one course has section and one does not, 204
    it("Should add dataset, only one course has section", async () => {
        const id: string = "oneSection";
        const expectedCode: number = 204;
        let response: InsightResponse;
        try {
            response = await insightFacade.addDataset(id, datasets[id], InsightDatasetKind.Courses);
        } catch (err) {
            response = err;
        } finally {
            expect(response.code).to.equal(expectedCode);
        }
    });

    // add dataset with one valid course and one invalid json file, 204
    it("Should add dataset with one valid course and one invalid json file", async () => {
        const id: string = "ovoin";
        const expectedCode: number = 204;
        let response: InsightResponse;
        try {
            response = await insightFacade.addDataset(id, datasets[id], InsightDatasetKind.Courses);
        } catch (err) {
            response = err;
        } finally {
            expect(response.code).to.equal(expectedCode);
        }
    });

    // add dataset with one text format, 400
    it("Fail to add dataset with text format", async () => {
        const id: string = "tCourses";
        const expectedCode: number = 400;
        let response: InsightResponse;
        try {
            response = await insightFacade.addDataset(id, datasets[id], InsightDatasetKind.Courses);
        } catch (err) {
            response = err;
        } finally {
            expect(response).to.haveOwnProperty("code");
            expect(response).to.haveOwnProperty("body");
            expect(response.code).to.equal(expectedCode);
            expect(response.body).to.have.property("error");
            expect(typeof((response.body as InsightResponseErrorBody).error)).to.equal(typeof(""));
        }
    });

    // add dataset with one valid course and one text form, 204
    it("Should add dataset with one valid course", async () => {
        const id: string = "ovot";
        const expectedCode: number = 204;
        let response: InsightResponse;
        try {
            response = await insightFacade.addDataset(id, datasets[id], InsightDatasetKind.Courses);
        } catch (err) {
            response = err;
        } finally {
            expect(response).to.haveOwnProperty("code");
            expect(response).to.haveOwnProperty("body");
            expect(response.code).to.equal(expectedCode);
        }
    });

    it("Should not add already existed dataset again", async () => {
        const id: string = "courses";
        const expectedCode: number = 400;
        let response: InsightResponse;
        try {
            response = await insightFacade.addDataset(id, datasets[id], InsightDatasetKind.Courses);
        } catch (err) {
            response = err;
        } finally {
            expect(response).to.haveOwnProperty("code");
            expect(response).to.haveOwnProperty("body");
            expect(response.code).to.equal(expectedCode);
            expect(response.body).to.have.property("error");
            expect(typeof((response.body as InsightResponseErrorBody).error)).to.equal(typeof(""));
        }
    });

    it("Failed to add dataset with invalid folder", async () => {
        const id: string = "infCourses";
        const expectedCode: number = 400;
        let response: InsightResponse;
        try {
            response = await insightFacade.addDataset(id, datasets[id], InsightDatasetKind.Courses);
        } catch (err) {
            response = err;
        } finally {
            expect(response).to.haveOwnProperty("code");
            expect(response).to.haveOwnProperty("body");
            expect(response.code).to.equal(expectedCode);
            expect(response.body).to.have.property("error");
            expect(typeof((response.body as InsightResponseErrorBody).error)).to.equal(typeof(""));
        }
    });

    it("should remove the dataset, again", async () => {
        const id: string = "courses";
        const expectedCode: number = 204;
        let response4: InsightResponse;
        try {
            response4 = await insightFacade.removeDataset(id);
        } catch (err) {
            response4 = err;
        } finally {
            expect(response4).to.haveOwnProperty("code");
            expect(response4).to.haveOwnProperty("body");
            expect(response4.code).to.equal(expectedCode);
        }
    });

    it("Failed to remove the course dataset, again", async () => {
        const id: string = "whatIsTheID";
        const expectedCode: number = 404;
        let response5: InsightResponse;
        try {
            response5 = await insightFacade.removeDataset(id);
        } catch (err) {
            response5 = err;
        } finally {
            expect(response5).to.haveOwnProperty("code");
            expect(response5).to.haveOwnProperty("body");
            expect(response5.code).to.equal(expectedCode);
            expect(response5.body).to.have.property("error");
            expect(typeof((response5.body as InsightResponseErrorBody).error)).to.equal(typeof(""));
        }
    });

    it("Failed to add dataset with empty RESULT", async () => {
        const id: string = "emResult";
        const expectedCode: number = 400;
        let response: InsightResponse;
        try {
            response = await insightFacade.addDataset(id, datasets[id], InsightDatasetKind.Courses);
        } catch (err) {
            response = err;
        } finally {
            expect(response.code).to.equal(expectedCode);
            expect(response.body).to.have.property("error");
            expect(typeof((response.body as InsightResponseErrorBody).error)).to.equal(typeof(""));
        }
    });

    it("Check listDatasets", async () => {
        const expectedCode: number = 200;
        let response: InsightResponse;
        try {
            response = await insightFacade.listDatasets();
        } catch (err) {
            response = err;
        } finally {
            expect(response.code).to.equal(expectedCode);
        }
    });

    // intentionally remove datasets
    it("Intentionally remove the dataset, oneSection", async () => {
        const id: string = "oneSection";
        const expectedCode: number = 204;
        let response4: InsightResponse;
        try {
            response4 = await insightFacade.removeDataset(id);
        } catch (err) {
            response4 = err;
        } finally {
            expect(response4).to.haveOwnProperty("code");
            expect(response4).to.haveOwnProperty("body");
            expect(response4.code).to.equal(expectedCode);
        }
    });

    it("Intentionally remove the dataset, ovoin", async () => {
        const id: string = "ovoin";
        const expectedCode: number = 204;
        let response4: InsightResponse;
        try {
            response4 = await insightFacade.removeDataset(id);
        } catch (err) {
            response4 = err;
        } finally {
            expect(response4).to.haveOwnProperty("code");
            expect(response4).to.haveOwnProperty("body");
            expect(response4.code).to.equal(expectedCode);
        }
    });

    it("Intentionally remove the dataset, ovot", async () => {
        const id: string = "ovot";
        const expectedCode: number = 204;
        let response4: InsightResponse;
        try {
            response4 = await insightFacade.removeDataset(id);
        } catch (err) {
            response4 = err;
        } finally {
            expect(response4).to.haveOwnProperty("code");
            expect(response4).to.haveOwnProperty("body");
            expect(response4.code).to.equal(expectedCode);
        }
    });

    it("Intentionally remove the dataset, rooms", async () => {
        const id: string = "rooms";
        const expectedCode: number = 204;
        let response4: InsightResponse;
        try {
            response4 = await insightFacade.removeDataset(id);
        } catch (err) {
            response4 = err;
        } finally {
            expect(response4).to.haveOwnProperty("code");
            expect(response4).to.haveOwnProperty("body");
            expect(response4.code).to.equal(expectedCode);
        }
    });
});

describe("Intentionally cache Dataset", function () {
    const datasetsToLoad: { [id: string]: string } = {
        courses: "./test/data/courses.zip",
        rooms: "./test/data/rooms.zip",
    };

    let insightFacade: InsightFacade;
    let datasets: { [id: string]: string };

    before(async function () {
        Log.test(`Before: ${this.test.parent.title}`);

        try {
            const loadDatasetPromises: Array<Promise<Buffer>> = [];
            for (const [id, path] of Object.entries(datasetsToLoad)) {
                loadDatasetPromises.push(TestUtil.readFileAsync(path));
            }
            const loadedDatasets = (await Promise.all(loadDatasetPromises)).map((buf, i) => {
                return {[Object.keys(datasetsToLoad)[i]]: buf.toString("base64")};
            });
            datasets = Object.assign({}, ...loadedDatasets);
            expect(Object.keys(datasets)).to.have.length.greaterThan(0);
        } catch (err) {
            expect.fail("", "", `Failed to read one or more datasets. ${JSON.stringify(err)}`);
        }

        try {
            insightFacade = new InsightFacade();
        } catch (err) {
            Log.error(err);
        } finally {
            expect(insightFacade).to.be.instanceOf(InsightFacade);
        }
    });

    beforeEach(function () {
        Log.test(`BeforeTest: ${this.currentTest.title}`);
    });

    after(function () {
        Log.test(`After: ${this.test.parent.title}`);
    });

    afterEach(function () {
        Log.test(`AfterTest: ${this.currentTest.title}`);
    });

    it("Should add a valid dataset", async () => {
        const id: string = "courses";
        const expectedCode: number = 204;
        let response: InsightResponse;

        try {
            response = await insightFacade.addDataset(id, datasets[id], InsightDatasetKind.Courses);
        } catch (err) {
            response = err;
        } finally {
            expect(response.code).to.equal(expectedCode);
        }
    });

    it("Should add a valid dataset, rooms", async () => {
        const id: string = "rooms";
        const expectedCode: number = 204;
        let response: InsightResponse;

        try {
            response = await insightFacade.addDataset(id, datasets[id], InsightDatasetKind.Rooms);
        } catch (err) {
            response = err;
        } finally {
            expect(response.code).to.equal(expectedCode);
        }
    });
});

describe("Intentionally fail to adding Dataset and delete cache Dataset", function () {
    const datasetsToLoad: { [id: string]: string } = {
        courses: "./test/data/courses.zip",
        rooms: "./test/data/rooms.zip",
    };

    let insightFacade: InsightFacade;
    let datasets: { [id: string]: string };

    before(async function () {
        Log.test(`Before: ${this.test.parent.title}`);

        try {
            const loadDatasetPromises: Array<Promise<Buffer>> = [];
            for (const [id, path] of Object.entries(datasetsToLoad)) {
                loadDatasetPromises.push(TestUtil.readFileAsync(path));
            }
            const loadedDatasets = (await Promise.all(loadDatasetPromises)).map((buf, i) => {
                return {[Object.keys(datasetsToLoad)[i]]: buf.toString("base64")};
            });
            datasets = Object.assign({}, ...loadedDatasets);
            expect(Object.keys(datasets)).to.have.length.greaterThan(0);
        } catch (err) {
            expect.fail("", "", `Failed to read one or more datasets. ${JSON.stringify(err)}`);
        }

        try {
            insightFacade = new InsightFacade();
        } catch (err) {
            Log.error(err);
        } finally {
            expect(insightFacade).to.be.instanceOf(InsightFacade);
        }
    });

    beforeEach(function () {
        Log.test(`BeforeTest: ${this.currentTest.title}`);
    });

    after(function () {
        Log.test(`After: ${this.test.parent.title}`);
    });

    afterEach(function () {
        Log.test(`AfterTest: ${this.currentTest.title}`);
    });

    it("Should fail add a valid dataset", async () => {
        const id: string = "courses";
        const expectedCode: number = 400;
        let response: InsightResponse;

        try {
            response = await insightFacade.addDataset(id, datasets[id], InsightDatasetKind.Courses);
        } catch (err) {
            response = err;
        } finally {
            expect(response.code).to.equal(expectedCode);
        }
    });

    it("Should fail to add a valid dataset, rooms", async () => {
        const id: string = "rooms";
        const expectedCode: number = 400;
        let response: InsightResponse;

        try {
            response = await insightFacade.addDataset(id, datasets[id], InsightDatasetKind.Rooms);
        } catch (err) {
            response = err;
        } finally {
            expect(response.code).to.equal(expectedCode);
        }
    });

    it("Should delete courses dataset", async () => {
        const id: string = "courses";
        const expectedCode: number = 204;
        let response: InsightResponse;

        try {
            response = await insightFacade.removeDataset(id);
        } catch (err) {
            response = err;
        } finally {
            expect(response.code).to.equal(expectedCode);
        }
    });

    it("Should delete dataset, rooms", async () => {
        const id: string = "rooms";
        const expectedCode: number = 204;
        let response: InsightResponse;

        try {
            response = await insightFacade.removeDataset(id);
        } catch (err) {
            response = err;
        } finally {
            expect(response.code).to.equal(expectedCode);
        }
    });
});

describe("InsightFacade whereBuilder", function () {
    let builder: WhereRebuilder;
    let counter = 0;

    before(async function () {
        Log.test(`Before: ${this.test.parent.title}`);
        builder = new WhereRebuilder();
    });

    beforeEach(function () {
        Log.test(`BeforeTest: ${this.currentTest.title}`);
    });

    after(function () {
        Log.test(`After: ${this.test.parent.title}`);
    });

    afterEach(function () {
        Log.test(`AfterTest: ${this.currentTest.title}`);
    });

    counter++;
    it("builder " + counter, () => {
        const data = {};
        const expected = {};
        expect(JSON.stringify(builder.rebuilder(data))).to.equal(JSON.stringify(expected));
    });

    counter++;
    it("fail builder " + counter, () => {
        const data = {fdsad: 1234};
        let response: InsightResponse;
        try {
            response = builder.rebuilder(data);
        } catch (err) {
            response = err;
        } finally {
            expect(response.code).to.be.equal(400);
        }
    });

    counter++;
    it("builder " + counter, () => {
        const data = {EQ: 1234};
        const expected = {EQ: 1234};
        expect(JSON.stringify(builder.rebuilder(data))).to.equal(JSON.stringify(expected));
    });

    counter++;
    it("builder " + counter, () => {
        const data = {LT: {}};
        const expected = {LT: {}};
        expect(JSON.stringify(builder.rebuilder(data))).to.equal(JSON.stringify(expected));
    });

    counter++;
    it("builder " + counter, () => {
        const data = {GT: {fdaf: 131}};
        const expected = {GT: {fdaf: 131}};
        expect(JSON.stringify(builder.rebuilder(data))).to.equal(JSON.stringify(expected));
    });

    counter++;
    it("builder " + counter, () => {
        const data = {IS: {fdaf: 131}};
        const expected = {IS: {fdaf: 131}};
        expect(JSON.stringify(builder.rebuilder(data))).to.equal(JSON.stringify(expected));
    });

    counter++;
    it("fail builder " + counter, () => {
        const data = {AND: 1234};
        let response: InsightResponse;
        try {
            response = builder.rebuilder(data);
        } catch (err) {
            response = err;
        } finally {
            expect(response.code).to.be.equal(400);
        }
    });

    counter++;
    it("fail builder " + counter, () => {
        const data = {OR: {fdaf: 131}};
        let response: InsightResponse;
        try {
            response = builder.rebuilder(data);
        } catch (err) {
            response = err;
        } finally {
            expect(response.code).to.be.equal(400);
        }
    });

    counter++;
    it("fail builder " + counter, () => {
        const data: any = {};
        data["OR"] = [];
        let response: InsightResponse;
        try {
            response = builder.rebuilder(data);
        } catch (err) {
            response = err;
        } finally {
            expect(response.code).to.be.equal(400);
        }
    });

    counter++;
    it("builder " + counter, () => {
        const data: any = {};
        data["AND"] = [{}];
        const expected = {AND: [{}]};
        expect(JSON.stringify(builder.rebuilder(data))).to.equal(JSON.stringify(expected));
    });

    counter++;
    it("builder " + counter, () => {
        const data: any = {};
        data["AND"] = [{}, {GT: {courses_avg: 97}}];
        expect(JSON.stringify(builder.rebuilder(data))).to.equal(JSON.stringify(data));
    });

    counter++;
    it("fail builder " + counter, () => {
        const data = {NOT: {}};
        let response: InsightResponse;
        try {
            response = builder.rebuilder(data);
        } catch (err) {
            response = err;
        } finally {
            expect(response.code).to.be.equal(400);
        }
    });

    counter++;
    it("fail builder " + counter, () => {
        const data = {NOT: 1234};
        let response: InsightResponse;
        try {
            response = builder.rebuilder(data);
        } catch (err) {
            response = err;
        } finally {
            expect(response.code).to.be.equal(400);
        }
    });

    counter++;
    it("builder " + counter, () => {
        const data: any = {};
        data["NOT"] = {IS: {courses_avg: 97}};
        expect(JSON.stringify(builder.rebuilder(data))).to.equal(JSON.stringify(data));
    });

    counter++;
    it("builder " + counter, () => {
        const data: any = {
            NOT: {
                LT: {
                    courses_avg: 50,
                },
            },
        };
        const expected: any = {
            OR: [
                {
                    GT: {
                        courses_avg: 50,
                    },
                },
                {
                    EQ: {
                        courses_avg: 50,
                    },
                },
            ],
        };
        expect(JSON.stringify(builder.rebuilder(data))).to.equal(JSON.stringify(expected));
    });

    counter++;
    it("builder " + counter, () => {
        const data: any = {};
        data["NOT"] = {IS: {courses_avg: 97}};
        expect(JSON.stringify(builder.rebuilder(data))).to.equal(JSON.stringify(data));
    });

    counter++;
    it("builder " + counter, () => {
        const data: any = {
            NOT: {
                GT: {
                    courses_avg: 50,
                },
            },
        };
        const expected: any = {
            OR: [
                {
                    LT: {
                        courses_avg: 50,
                    },
                },
                {
                    EQ: {
                        courses_avg: 50,
                    },
                },
            ],
        };
        expect(JSON.stringify(builder.rebuilder(data))).to.equal(JSON.stringify(expected));
    });

    counter++;
    it("builder " + counter, () => {
        const data: any = {
            NOT: {
                EQ: {
                    courses_avg: 50,
                },
            },
        };
        const expected: any = {
            OR: [
                {
                    LT: {
                        courses_avg: 50,
                    },
                },
                {
                    GT: {
                        courses_avg: 50,
                    },
                },
            ],
        };
        expect(JSON.stringify(builder.rebuilder(data))).to.equal(JSON.stringify(expected));
    });

    counter++;
    it("builder " + counter, () => {
        const data: any = {
            NOT: {
                IS: {
                    courses_avg: 50,
                },
            },
        };
        expect(JSON.stringify(builder.rebuilder(data))).to.equal(JSON.stringify(data));
    });

    counter++;
    it("builder " + counter, () => {
        const data: any = {
            NOT: {
                NOT: {
                    GT: {
                        courses_avg: 50,
                    },
                },
            },
        };
        const expected: any = {
            GT: {
                courses_avg: 50,
            },
        };
        expect(JSON.stringify(builder.rebuilder(data))).to.equal(JSON.stringify(expected));
    });

    counter++;
    it("builder " + counter, () => {
        const data: any = {
            NOT: {
                NOT: {
                    NOT: {
                        GT: {
                            courses_avg: 50,
                        },
                    },
                },
            },
        };
        const expected: any = {
            OR: [
                {
                    LT: {
                        courses_avg: 50,
                    },
                },
                {
                    EQ: {
                        courses_avg: 50,
                    },
                },
            ],
        };
        expect(JSON.stringify(builder.rebuilder(data))).to.equal(JSON.stringify(expected));
    });

    counter++;
    it("builder " + counter, () => {
        const data: any = {
            NOT: {
                NOT: {
                    NOT: {
                        NOT: {
                            GT: {
                                courses_avg: 50,
                            },
                        },
                    },
                },
            },
        };
        const expected: any = {
            GT: {
                courses_avg: 50,
            },
        };
        expect(JSON.stringify(builder.rebuilder(data))).to.equal(JSON.stringify(expected));
    });

    counter++;
    it("builder " + counter, () => {
        const data: any = {
            AND: [
                {
                    AND: [
                        {
                            AND: [
                                {
                                    GT: {
                                        courses_avg: 0,
                                    },
                                },
                                {
                                    LT: {
                                        courses_avg: 100,
                                    },
                                },
                            ],
                        },
                        {
                            GT: {
                                courses_avg: 30,
                            },
                        },
                    ],
                },
                {
                    LT: {
                        courses_avg: 70,
                    },
                },
                {
                    AND: [
                        {
                            GT: {
                                courses_avg: 0,
                            },
                        },
                        {
                            LT: {
                                courses_avg: 100,
                            },
                        },
                    ],
                },
            ],
        };
        const expected: any = {
            AND: [
                {
                    GT: {
                        courses_avg: 0,
                    },
                },
                {
                    LT: {
                        courses_avg: 100,
                    },
                },
                {
                    GT: {
                        courses_avg: 30,
                    },
                },
                {
                    LT: {
                        courses_avg: 70,
                    },
                },
                {
                    GT: {
                        courses_avg: 0,
                    },
                },
                {
                    LT: {
                        courses_avg: 100,
                    },
                },
            ],
        };
        expect(JSON.stringify(builder.rebuilder(data))).to.equal(JSON.stringify(expected));
    });

    counter++;
    it("builder " + counter, () => {
        const data: any = {
            AND: [
                {
                    AND: [
                        {
                            AND: [
                                {
                                    GT: {
                                        courses_avg: 0,
                                    },
                                },
                                {
                                    LT: {
                                        courses_avg: 100,
                                    },
                                },
                            ],
                        },
                        {
                            GT: {
                                courses_avg: 30,
                            },
                        },
                    ],
                },
                {
                    LT: {
                        courses_avg: 70,
                    },
                },
            ],
        };
        const expected: any = {
            AND: [
                {
                    GT: {
                        courses_avg: 0,
                    },
                },
                {
                    LT: {
                        courses_avg: 100,
                    },
                },
                {
                    GT: {
                        courses_avg: 30,
                    },
                },
                {
                    LT: {
                        courses_avg: 70,
                    },
                },
            ],
        };
        expect(JSON.stringify(builder.rebuilder(data))).to.equal(JSON.stringify(expected));
    });

    counter++;
    it("builder " + counter, () => {
        const data: any = {
            AND: [
                {
                    AND: [
                        {
                            AND: [
                                {
                                    GT: {
                                        courses_avg: 0,
                                    },
                                },
                                {
                                    LT: {
                                        courses_avg: 100,
                                    },
                                },
                            ],
                        },
                        {
                            GT: {
                                courses_avg: 30,
                            },
                        },
                    ],
                },
                {
                    LT: {
                        courses_avg: 70,
                    },
                },
                {
                    OR: [
                        {
                            GT: {
                                courses_avg: 0,
                            },
                        },
                        {
                            LT: {
                                courses_avg: 100,
                            },
                        },
                    ],
                },
            ],
        };
        const expected: any = {
            AND: [
                {
                    GT: {
                        courses_avg: 0,
                    },
                },
                {
                    LT: {
                        courses_avg: 100,
                    },
                },
                {
                    GT: {
                        courses_avg: 30,
                    },
                },
                {
                    LT: {
                        courses_avg: 70,
                    },
                },
                {
                    OR: [
                        {
                            GT: {
                                courses_avg: 0,
                            },
                        },
                        {
                            LT: {
                                courses_avg: 100,
                            },
                        },
                    ],
                },
            ],
        };
        expect(JSON.stringify(builder.rebuilder(data))).to.equal(JSON.stringify(expected));
    });

    counter++;
    it("builder " + counter, () => {
        const data: any = {
            NOT: {
                AND: [
                    {
                        GT: {
                            courses_avg: 0,
                        },
                    },
                    {
                        LT: {
                            courses_avg: 100,
                        },
                    },
                ],
            },
        };
        const expected: any = {
            OR: [
                {
                    LT: {
                        courses_avg: 0,
                    },
                },
                {
                    EQ: {
                        courses_avg: 0,
                    },
                },
                {
                    GT: {
                        courses_avg: 100,
                    },
                },
                {
                    EQ: {
                        courses_avg: 100,
                    },
                },
            ],
        };
        expect(JSON.stringify(builder.rebuilder(data))).to.equal(JSON.stringify(expected));
    });

    counter++;
    it("builder " + counter, () => {
        const data: any = {
            OR: [
                {
                    OR: [
                        {
                            OR: [
                                {
                                    GT: {
                                        courses_avg: 0,
                                    },
                                },
                                {
                                    LT: {
                                        courses_avg: 100,
                                    },
                                },
                            ],
                        },
                        {
                            GT: {
                                courses_avg: 30,
                            },
                        },
                    ],
                },
                {
                    LT: {
                        courses_avg: 70,
                    },
                },
                {
                    NOT: {
                        AND: [
                            {
                                GT: {
                                    courses_avg: 0,
                                },
                            },
                            {
                                LT: {
                                    courses_avg: 100,
                                },
                            },
                        ],
                    },
                },
            ],
        };
        const expected: any = {
            OR: [
                {
                    GT: {
                        courses_avg: 0,
                    },
                },
                {
                    LT: {
                        courses_avg: 100,
                    },
                },
                {
                    GT: {
                        courses_avg: 30,
                    },
                },
                {
                    LT: {
                        courses_avg: 70,
                    },
                },
                {
                    LT: {
                        courses_avg: 0,
                    },
                },
                {
                    EQ: {
                        courses_avg: 0,
                    },
                },
                {
                    GT: {
                        courses_avg: 100,
                    },
                },
                {
                    EQ: {
                        courses_avg: 100,
                    },
                },
            ],
        };
        expect(JSON.stringify(builder.rebuilder(data))).to.equal(JSON.stringify(expected));
    });

    counter++;
    it("builder " + counter, () => {
        const data: any = {
            NOT: {
                OR: [
                    {
                        GT: {
                            courses_avg: 0,
                        },
                    },
                    {
                        LT: {
                            courses_avg: 100,
                        },
                    },
                ],
            },
        };
        const expected: any = {
            AND: [
                {
                    OR: [
                        {
                            LT: {
                                courses_avg: 0,
                            },
                        },
                        {
                            EQ: {
                                courses_avg: 0,
                            },
                        },
                    ],
                },
                {
                    OR: [
                        {
                            GT: {
                                courses_avg: 100,
                            },
                        },
                        {
                            EQ: {
                                courses_avg: 100,
                            },
                        },
                    ],
                },
            ],
        };
        expect(JSON.stringify(builder.rebuilder(data))).to.equal(JSON.stringify(expected));
    });

    counter++;
    it("fail builder " + counter, () => {
        const data = {NOT: {OR: 123}};
        let response: InsightResponse;
        try {
            response = builder.rebuilder(data);
        } catch (err) {
            response = err;
        } finally {
            expect(response.code).to.be.equal(400);
        }
    });

    counter++;
    it("builder " + counter, () => {
        const data: any = {
            AND: [
                {
                    AND: [
                        {
                            AND: [
                                {
                                    GT: {
                                        courses_avg: 0,
                                    },
                                },
                                {
                                    LT: {
                                        courses_avg: 100,
                                    },
                                },
                            ],
                        },
                        {
                            GT: {
                                courses_avg: 30,
                            },
                        },
                    ],
                },
                {
                    LT: {
                        courses_avg: 70,
                    },
                },
                {
                    NOT: {
                        OR: [
                            {
                                GT: {
                                    courses_avg: 0,
                                },
                            },
                            {
                                LT: {
                                    courses_avg: 100,
                                },
                            },
                        ],
                    },
                },
            ],
        };
        const expected: any = {
            AND: [
                {
                    GT: {
                        courses_avg: 0,
                    },
                },
                {
                    LT: {
                        courses_avg: 100,
                    },
                },
                {
                    GT: {
                        courses_avg: 30,
                    },
                },
                {
                    LT: {
                        courses_avg: 70,
                    },
                },
                {
                    OR: [
                        {
                            LT: {
                                courses_avg: 0,
                            },
                        },
                        {
                            EQ: {
                                courses_avg: 0,
                            },
                        },
                    ],
                },
                {
                    OR: [
                        {
                            GT: {
                                courses_avg: 100,
                            },
                        },
                        {
                            EQ: {
                                courses_avg: 100,
                            },
                        },
                    ],
                },
            ],
        };
        expect(JSON.stringify(builder.rebuilder(data))).to.equal(JSON.stringify(expected));
    });
});

// This test suite dynamically generates tests from the JSON files in test/queries.
// You should not need to modify it; instead, add additional files to the queries directory.
describe("InsightFacade PerformQuery", () => {
    const datasetsToQuery: { [id: string]: string } = {
        courses: "./test/data/courses.zip",
        rooms:   "./test/data/rooms.zip",
    };
    let insightFacade: InsightFacade;
    let testQueries: ITestQuery[] = [];

    // Create a new instance of InsightFacade, read in the test queries from test/queries and
    // add the datasets specified in datasetsToQuery.
    before(async function () {
        Log.test(`Before: ${this.test.parent.title}`);

        // Load the query JSON files under test/queries.
        // Fail if there is a problem reading ANY query.
        try {
            testQueries = await TestUtil.readTestQueries();
            expect(testQueries).to.have.length.greaterThan(0);
        } catch (err) {
            expect.fail("", "", `Failed to read one or more test queries. ${JSON.stringify(err)}`);
        }

        try {
            insightFacade = new InsightFacade();
        } catch (err) {
            Log.error(err);
        } finally {
            expect(insightFacade).to.be.instanceOf(InsightFacade);
        }

        // Load the datasets specified in datasetsToQuery and add them to InsightFacade.
        // Fail if there is a problem reading ANY dataset.
        try {
            const loadDatasetPromises: Array<Promise<Buffer>> = [];
            for (const [id, path] of Object.entries(datasetsToQuery)) {
                loadDatasetPromises.push(TestUtil.readFileAsync(path));
            }
            const loadedDatasets = (await Promise.all(loadDatasetPromises)).map((buf, i) => {
                return {[Object.keys(datasetsToQuery)[i]]: buf.toString("base64")};
            });
            expect(loadedDatasets).to.have.length.greaterThan(0);

            const responsePromises: Array<Promise<InsightResponse>> = [];
            const datasets: { [id: string]: string } = Object.assign({}, ...loadedDatasets);
            for (const [id, content] of Object.entries(datasets)) {
                // TODO: something should be changed based on the Kind.
                if (id === "rooms") {
                    responsePromises.push(insightFacade.addDataset(id, content, InsightDatasetKind.Rooms));
                } else {
                    responsePromises.push(insightFacade.addDataset(id, content, InsightDatasetKind.Courses));
                }
                // responsePromises.push(insightFacade.addDataset(id, content, InsightDatasetKind.Courses));
            }

            // This try/catch is a hack to let your dynamic tests execute enough the addDataset method fails.
            // In D1, you should remove this try/catch to ensure your datasets load successfully before trying
            // to run you queries.
            // try {
            //     const responses: InsightResponse[] = await Promise.all(responsePromises);
            //     responses.forEach((response) => expect(response.code).to.equal(204));
            // } catch (err) {
            //     Log.warn(`Ignoring addDataset errors. For D1, you should allow errors to fail the Before All hook.`);
            // }
        } catch (err) {
            expect.fail("", "", `Failed to read one or more datasets. ${JSON.stringify(err)}`);
        }
    });

    beforeEach(function () {
        Log.test(`BeforeTest: ${this.currentTest.title}`);
    });

    after(function () {
        Log.test(`After: ${this.test.parent.title}`);
    });

    afterEach(function () {
        Log.test(`AfterTest: ${this.currentTest.title}`);
    });

    // Dynamically create and run a test for each query in testQueries
    it("Should run test queries", () => {
        describe("Dynamic InsightFacade PerformQuery tests", () => {
            for (const test of testQueries) {
                it(`[${test.filename}] ${test.title}`, async () => {
                    let response: InsightResponse;

                    try {
                        response = await insightFacade.performQuery(test.query);
                    } catch (err) {
                        response = err;
                    } finally {
                        expect(response.code).to.equal(test.response.code);

                        if (test.response.code >= 400) {
                            expect(response.body).to.have.property("error");
                        } else {
                            expect(response.body).to.have.property("result");
                            const expectedResult = (test.response.body as InsightResponseSuccessBody).result;
                            const actualResult = (response.body as InsightResponseSuccessBody).result;
                            expect(actualResult).to.deep.equal(expectedResult);
                        }
                    }
                });
            }

            // test Empty where for courses
            it("test empty where for courses", async () => {
                let response: InsightResponse;
                let aQuery = {
                    WHERE: {},
                    OPTIONS: {
                        COLUMNS: [
                            "courses_dept",
                            "courses_id",
                            "courses_avg",
                            "courses_instructor",
                            "courses_title",
                            "courses_pass",
                            "courses_fail",
                            "courses_audit",
                            "courses_year",
                            "courses_uuid",
                            "courses_dept",
                            "courses_id",
                            "courses_avg",
                            "courses_instructor",
                            "courses_title",
                            "courses_pass",
                            "courses_fail",
                            "courses_audit",
                            "courses_year",
                            "courses_uuid",
                        ],
                    },
                };
                try {
                    response = await insightFacade.performQuery(aQuery);
                } catch (err) {
                    response = err;
                } finally {
                    let oneElement = (response.body as InsightResponseSuccessBody).result[0];
                    for (const obj of Object.keys(oneElement)) {
                        if (typeof oneElement[obj] === "undefined") {
                            expect.fail();
                        }
                    }
                    expect(response.code).to.be.equal(200);
                    expect((response.body as InsightResponseSuccessBody).result.length).to.be.equal(64612);
                }
            });

            it("test empty where for rooms", async () => {
                let response: InsightResponse;
                let aQuery = {
                    WHERE: {},
                    OPTIONS: {
                        COLUMNS: [
                            "rooms_address",
                            "rooms_fullname",
                            "rooms_shortname",
                            "rooms_furniture",
                            "rooms_href",
                            "rooms_lat",
                            "rooms_lon",
                            "rooms_name",
                            "rooms_number",
                            "rooms_seats",
                            "rooms_type",
                        ],
                    },
                };
                try {
                    response = await insightFacade.performQuery(aQuery);
                } catch (err) {
                    response = err;
                } finally {
                    let oneElement = (response.body as InsightResponseSuccessBody).result[0];
                    for (const obj of Object.keys(oneElement)) {
                        if (typeof oneElement[obj] === "undefined") {
                            expect.fail();
                        }
                    }
                    expect(response.code).to.be.equal(200);
                    expect((response.body as InsightResponseSuccessBody).result.length).to.be.equal(364);
                }
            });

            it("test empty reject", async () => {
                let response: InsightResponse;
                let aQuery = {
                    WHERE: {
                        AND: [
                            {
                                EQ: 1234,
                            },
                            {
                                EQ: {
                                    rooms_lon: -123.25318,
                                },
                            },
                        ],
                    },
                    OPTIONS: {
                        COLUMNS: [
                            "rooms_fullname",
                            "rooms_number",
                            "rooms_lat",
                            "rooms_lon",
                        ],
                        ORDER: "rooms_number",
                        FORM: "TABLE",
                    },
                };
                try {
                    response = await insightFacade.performQuery(aQuery);
                } catch (err) {
                    response = err;
                } finally {
                    expect(response.code).to.be.equal(400);
                }
            });

            // Intentionally remove all data after query.
            for (const [id, path] of Object.entries(datasetsToQuery)) {
                it("should remove the dataset" + id, async () => {
                    const expectedCode: number = 204;
                    let response4: InsightResponse;
                    try {
                        response4 = await insightFacade.removeDataset(id);
                    } catch (err) {
                        response4 = err;
                    } finally {
                        expect(response4.code).to.equal(expectedCode);
                    }
                });
            }
        });
    });
});
