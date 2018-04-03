import Server from "../src/rest/Server";

import chai = require("chai");

import chaiHttp = require("chai-http");

import { expect } from "chai";
import fs = require("fs");
import Log from "../src/Util";
describe("Facade D3", function () {
    this.timeout(10000); // TODO: this have to delete

    let server: Server = null;

    chai.use(chaiHttp);

    before(function () {
        server = new Server(4321);
        // TODO: start server here once and handle errors properly

        server.start().then(function (val: boolean) {
            Log.info("Server - started: " + val);
        }).catch(function (err: Error) {
            Log.error("Server start - ERROR: " + err.message);
        });
    });

    after(function () {
        // TODO: stop server here once!
        server.stop().then(function (val: boolean) {
            Log.info("Server - ended: " + val);
        }).catch(function (err: Error) {
            Log.error("Server end - ERROR: " + err.message);
        });
    });

    beforeEach(function () {
        // might want to add some process logging here to keep track of what"s going on
    });

    afterEach(function () {
        // might want to add some process logging here to keep track of what"s going on
    });

    it("Server has started", function () {
        return chai.request("http://localhost:4321").get("/echo/310").then(function (response) {
            expect(response.body.result).to.equal("310...310");
        }).catch(function (err) {
            expect.fail();
        });
    });

    it("test getStatic, lol", function () {
        return chai.request("http://localhost:4321").get("/lol").then(function (response) {
            expect.fail();
        }).catch(function (err) {
            expect(err.status).to.be.equal(500);
        });
    });

    it("test getStatic, boring test", function () {
        return chai.request("http://localhost:4321").get("").then(function (response) {
            expect(response.status).to.be.equal(200);
        }).catch(function (err) {
            expect.fail();
        });
    });

    // it("GET /say-hallo-to/Felix responds with 'Hallo Felix'", function () {
    //     return chai.request("http://localhost:4321").get("/say-hallo-to/Felix").then(function (response) {
    //         expect(response.body.result).to.equal("Hallo Felix");
    //     }).catch(function (err) {
    //         expect.fail();
    //     });
    // });

    // TODO: read your courses and rooms datasets here once!

    // Hint on how to test PUT requests
    /*
    it("PUT test for courses dataset", function () {
        try {
            return chai.request(URL)
                .put(YOUR_PUT_URL)
                .attach("body", YOUR_COURSES_DATASET, COURSES_ZIP_FILENAME)
                .then(function (res: Response) {
                    // some logging here please!
                    expect(res.status).to.be.equal(204);
                })
                .catch(function (err) {
                    // some logging here please!
                    expect.fail();
                });
        } catch (err) {
            // and some more logging here!
        }
    });
    */
    it("PUT test for rooms dataset", function () {
        try {
            return chai.request("http://localhost:4321")
                .put("/dataset/rooms/rooms")
                .attach("body", fs.readFileSync("./test/data/rooms.zip"), "rooms.zip")
                .then(function (res) {
                    // some logging here please!
                    expect(res.status).to.be.equal(204);
                })
                .catch(function (err) {
                    // some logging here please!
                    expect.fail();
                });
        } catch (err) {
            // and some more logging here!
        }
    });

    it("PUT test for rooms dataset, failed to add duplicated dataset", function () {
        try {
            return chai.request("http://localhost:4321")
                .put("/dataset/rooms/rooms")
                .attach("body", fs.readFileSync("./test/data/rooms.zip"), "rooms.zip")
                .then(function (res) {
                    // some logging here please!
                    expect.fail();
                })
                .catch(function (err) {
                    // some logging here please!
                    expect(err.status).to.be.equal(400);
                });
        } catch (err) {
            // and some more logging here!
        }
    });

    it("PUT test for invalid dataset", function () {
        try {
            return chai.request("http://localhost:4321")
                .put("/dataset/courses/courses")
                .attach("body", fs.readFileSync("./test/data/courses.json"), "courses.json")
                .then(function (res) {
                    // some logging here please!
                    expect.fail();
                })
                .catch(function (err) {
                    // some logging here please!
                    expect(err.status).to.be.equal(400);
                });
        } catch (err) {
            // and some more logging here!
        }
    });

    it("PUT test for courses dataset", function () {
        try {
            return chai.request("http://localhost:4321")
                .put("/dataset/courses/courses")
                .attach("body", fs.readFileSync("./test/data/courses.zip"), "courses.zip")
                .then(function (res) {
                    // some logging here please!
                    expect(res.status).to.be.equal(204);
                })
                .catch(function (err) {
                    // some logging here please!
                    global.console.log(err);
                    expect.fail();
                });
        } catch (err) {
            // and some more logging here!
        }
    });

    // // listDataset
    it("listDataset test", function () {
        try {
            return chai.request("http://localhost:4321")
                .get("/datasets")
                .then(function (res) {
                    // some logging here please!
                    expect(res.status).to.be.equal(200);
                })
                .catch(function (err) {
                    // some logging here please!
                    expect.fail();
                });
        } catch (err) {
            // and some more logging here!
        }
    });

    // delete
    it("DELETE test for rooms dataset", function () {
        try {
            return chai.request("http://localhost:4321")
                .del("/dataset/rooms")
                .then(function (res) {
                    // some logging here please!
                    expect(res.status).to.be.equal(204);
                })
                .catch(function (err) {
                    // some logging here please!
                    expect.fail();
                });
        } catch (err) {
            // and some more logging here!
        }
    });

    it("DELETE test for courses dataset", function () {
        try {
            return chai.request("http://localhost:4321")
                .del("/dataset/courses")
                .then(function (res) {
                    // some logging here please!
                    expect(res.status).to.be.equal(204);
                })
                .catch(function (err) {
                    // some logging here please!
                    expect.fail();
                });
        } catch (err) {
            // and some more logging here!
        }
    });

    it("DELETE test for rooms dataset, failed to delete one not existed", function () {
        try {
            return chai.request("http://localhost:4321")
                .del("/dataset/rooms")
                .then(function (res) {
                    // some logging here please!
                    expect.fail();
                })
                .catch(function (err) {
                    // some logging here please!
                    expect(err.status).to.be.equal(404);
                });
        } catch (err) {
            // and some more logging here!
        }
    });

    // test Post
    it("PUT test for rooms dataset for POST", function () {
        try {
            return chai.request("http://localhost:4321")
                .put("/dataset/rooms/rooms")
                .attach("body", fs.readFileSync("./test/data/rooms.zip"), "rooms.zip")
                .then(function (res) {
                    // some logging here please!
                    expect(res.status).to.be.equal(204);
                })
                .catch(function (err) {
                    // some logging here please!
                    expect.fail();
                });
        } catch (err) {
            // and some more logging here!
        }
    });

    // TODO: post from here
    it("POST a query for rooms, pass", function () {
        let sendData = {
            WHERE: {
                AND: [
                    {
                        EQ: {
                            rooms_lat: 49.2699,
                        },
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
            return chai.request("http://localhost:4321")
                .post("/query")
                .send(JSON.stringify(sendData))
                .then(function (res) {
                    // some logging here please!
                    const expected = [
                        {rooms_fullname: "Allard Hall (LAW)", rooms_number: "105",
                            rooms_lat: 49.2699, rooms_lon: -123.25318},
                        {rooms_fullname: "Allard Hall (LAW)", rooms_number: "112",
                            rooms_lat: 49.2699, rooms_lon: -123.25318},
                        {rooms_fullname: "Allard Hall (LAW)", rooms_number: "113",
                            rooms_lat: 49.2699, rooms_lon: -123.25318},
                        {rooms_fullname: "Allard Hall (LAW)", rooms_number: "121",
                            rooms_lat: 49.2699, rooms_lon: -123.25318},
                        {rooms_fullname: "Allard Hall (LAW)", rooms_number: "B101",
                            rooms_lat: 49.2699, rooms_lon: -123.25318}];
                    const result = res.body.result;
                    expect(res.status).to.be.equal(200);
                })
                .catch(function (err) {
                    // some logging here please!
                    expect.fail();
                });
        } catch (err) {
            // and some more logging here!
        }
    });

    it("POST a query for rooms, error", function () {
        let data = {
            WHERE: {
                AND: [
                    {
                        EQ: {
                            courses_avg: 49.2699,
                        },
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
            return chai.request("http://localhost:4321")
                .post("/query")
                .send(JSON.stringify(data))
                .then(function (res) {
                    // some logging here please!
                    expect.fail();
                })
                .catch(function (err) {
                    // some logging here please!
                    expect(err.status).to.be.equal(400);
                });
        } catch (err) {
            // and some more logging here!
        }
    });

    it("POST a query for rooms, error, EQ:1234", function () {
        let data = {
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
            return chai.request("http://localhost:4321")
                .post("/query")
                .send(JSON.stringify(data))
                .then(function (res) {
                    // some logging here please!
                    expect.fail();
                })
                .catch(function (err) {
                    // some logging here please!
                    expect(err.status).to.be.equal(400);
                });
        } catch (err) {
            // and some more logging here!
            Log.trace("???");
        }
    });
    // TODO: post end here

    it("DELETE test for rooms dataset for POST", function () {
        try {
            return chai.request("http://localhost:4321")
                .del("/dataset/rooms")
                .then(function (res) {
                    // some logging here please!
                    expect(res.status).to.be.equal(204);
                })
                .catch(function (err) {
                    // some logging here please!
                    expect.fail();
                });
        } catch (err) {
            // and some more logging here!
        }
    });

    // The other endpoints work similarly. You should be able to find all instructions at the chai-http documentation
});

describe("Facade D3, for initiate Server", function () {
    // this.timeout(10000); // TODO: this have to delete

    let server: Server = null;

    chai.use(chaiHttp);

    before(function () {
        server = new Server(4321);

        server.start().then(function (val: boolean) {
            Log.info("Server - started: " + val);
        }).catch(function (err: Error) {
            Log.error("Server start - ERROR: " + err.message);
        });
    });

    after(function () {
        server.stop().then(function (val: boolean) {
            Log.info("Server - ended: " + val);
        }).catch(function (err: Error) {
            Log.error("Server end - ERROR: " + err.message);
        });
    });

    beforeEach(function () {
        // might want to add some process logging here to keep track of what"s going on
    });

    afterEach(function () {
        // might want to add some process logging here to keep track of what"s going on
    });

    it("PUT test for courses dataset, for Init", function () {
        try {
            return chai.request("http://localhost:4321")
                .put("/dataset/courses/courses")
                .attach("body", fs.readFileSync("./test/data/courses.zip"), "courses.zip")
                .then(function (res) {
                    // some logging here please!
                    expect(res.status).to.be.equal(204);
                })
                .catch(function (err) {
                    // some logging here please!
                    global.console.log(err);
                    expect.fail();
                });
        } catch (err) {
            // and some more logging here!
        }
    });

    it("PUT test for rooms dataset, for init", function () {
        try {
            return chai.request("http://localhost:4321")
                .put("/dataset/rooms/rooms")
                .attach("body", fs.readFileSync("./test/data/rooms.zip"), "rooms.zip")
                .then(function (res) {
                    // some logging here please!
                    expect(res.status).to.be.equal(204);
                })
                .catch(function (err) {
                    // some logging here please!
                    global.console.log(err);
                    expect.fail();
                });
        } catch (err) {
            // and some more logging here!
        }
    });
});
