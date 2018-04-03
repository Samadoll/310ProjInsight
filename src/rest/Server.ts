/**
 * Created by rtholmes on 2016-06-19.
 */

import fs = require("fs");
import restify = require("restify");
import Log from "../Util";
import {InsightDatasetKind, InsightResponse} from "../controller/IInsightFacade";
import InsightFacade from "../controller/InsightFacade";
import {bodyParser} from "restify";
let insightFacade: InsightFacade;

/**
 * This configures the REST endpoints for the server.
 */
export default class Server {

    private port: number;
    private rest: restify.Server;

    constructor(port: number) {
        Log.info("Server::<init>( " + port + " )");
        this.port = port;
        insightFacade = new InsightFacade();
    }

    /**
     * Stops the server. Again returns a promise so we know when the connections have
     * actually been fully closed and the port has been released.
     *
     * @returns {Promise<boolean>}
     */
    public stop(): Promise<boolean> {
        Log.info("Server::close()");
        const that = this;
        return new Promise(function (fulfill) {
            that.rest.close(function () {
                fulfill(true);
            });
        });
    }

    /**
     * Starts the server. Returns a promise with a boolean value. Promises are used
     * here because starting the server takes some time and we want to know when it
     * is done (and if it worked).
     *
     * @returns {Promise<boolean>}
     */
    public start(): Promise<boolean> {
        const that = this;
        return new Promise(function (fulfill, reject) {
            try {
                Log.info("Server::start() - start");

                that.rest = restify.createServer({
                    name: "insightUBC",
                });

                that.rest.use(
                    function crossOrigin(req, res, next) {
                        res.header("Access-Control-Allow-Origin", "*");
                        res.header("Access-Control-Allow-Headers", "X-Requested-With");
                        return next();
                    });

                // This is an example endpoint that you can invoke by accessing this URL in your browser:
                // http://localhost:4321/echo/hello
                that.rest.get("/echo/:msg", Server.echo);

                // NOTE: your endpoints should go here
                that.rest.use(bodyParser({mapFiles: true}));
                // add dataset
                that.rest.put("/dataset/:id/:kind", Server.addDataset);
                // delete Dataset
                that.rest.del("/dataset/:id", Server.deleteDataset);
                // add query
                that.rest.post("/query", Server.performQuery);
                // get dataset
                that.rest.get("/datasets", Server.listDatasets);

                // This must be the last endpoint!
                that.rest.get("/.*", Server.getStatic);

                that.rest.listen(that.port, function () {
                    Log.info("Server::start() - restify listening: " + that.rest.url);
                    fulfill(true);
                });

                that.rest.on("error", function (err: string) {
                    // catches errors in restify start; unusual syntax due to internal
                    // node not using normal exceptions here
                    Log.info("Server::start() - restify ERROR: " + err);
                    reject(err);
                });

            } catch (err) {
                Log.error("Server::start() - ERROR: " + err);
                reject(err);
            }
        });
    }

    // Add dataset
    private static addDataset(req: restify.Request, res: restify.Response, next: restify.Next) {
        Log.trace("Server::addDataset(..)");
        let content = new Buffer(req.params.body).toString("base64");
        const id: string = req.params.id;
        const kind: string = req.params.kind;
        let insightKind: InsightDatasetKind;
        Log.trace("Server::addDataset(..) - id: " + id);
        Log.trace("Server::addDataset(..) - rooms: " + kind);
        switch (kind) {
            case "rooms":
                insightKind = InsightDatasetKind.Rooms;
                break;
            case "courses":
                insightKind = InsightDatasetKind.Courses;
                break;
        }
        // let insightFacade = new InsightFacade();
        insightFacade.addDataset(id, content, insightKind)
            .then((result) => {
                res.status(result.code);
                res.json(result.code, result.body);
            }).catch((err) => {
            res.status(err.code);
            res.json(err.code, err.body);
        });
        return next();
    }

    // Delete dataSet
    private static deleteDataset(req: restify.Request, res: restify.Response, next: restify.Next) {
        Log.trace("Server::deleteDataset");
        const id: string = req.params.id;
        Log.trace("Server::deleteDataset(..) - id: " + id);
        // let insightFacade = new InsightFacade();
        insightFacade.removeDataset(id).then((response) => {
            res.status(response.code);
            res.json(response.code, response.body);
        }).catch((err) => {
            res.status(err.code);
            res.json(err.code, err.body);
        });

        return next();
    }

    // Post Query
    private static performQuery(req: restify.Request, res: restify.Response, next: restify.Next) {
        // TODO: performQuery
        Log.trace("Server::performQuery");
        const query = req.body;
        let queryObj;
        if (typeof query === "string") {
            queryObj = JSON.parse(query);
        } else {
            queryObj = query;
        }
        insightFacade.performQuery(queryObj).then((response) => {
            res.status(response.code);
            res.json(response.code, response.body);
        }).catch((err) => {
            res.status(err.code);
            res.json(err.code, err.body);
        });
        return next();
    }

    private static listDatasets(req: restify.Request, res: restify.Response, next: restify.Next) {
        Log.trace("Server::listDatasets");
        insightFacade.listDatasets().then((response) => {
            res.status(response.code);
            res.json(response.code, response.body);
        }).catch((err) => {
            // No any errors in listDatasets
        });
        return next();
    }

    // The next two methods handle the echo service.
    // These are almost certainly not the best place to put these, but are here for your reference.
    // By updating the Server.echo function pointer above, these methods can be easily moved.
    private static echo(req: restify.Request, res: restify.Response, next: restify.Next) {
        Log.trace("Server::echo(..) - params: " + JSON.stringify(req.params));
        try {
            const result = Server.performEcho(req.params.msg);
            Log.info("Server::echo(..) - responding " + result.code);
            res.json(result.code, result.body);
        } catch (err) {
            Log.error("Server::echo(..) - responding 400");
            res.json(400, {error: err.message});
        }
        return next();
    }

    private static performEcho(msg: string): InsightResponse {
        if (typeof msg !== "undefined" && msg !== null) {
            return {code: 200, body: {result: msg + "..." + msg}};
        } else {
            return {code: 400, body: {error: "Message not provided"}};
        }
    }

    private static getStatic(req: restify.Request, res: restify.Response, next: restify.Next) {
        const publicDir = "frontend/public/";
        Log.trace("RoutHandler::getStatic::" + req.url);
        let path = publicDir + "index.html";
        if (req.url !== "/") {
            path = publicDir + req.url.split("/").pop();
        }
        fs.readFile(path, function (err: Error, file: Buffer) {
            if (err) {
                res.send(500);
                Log.error(JSON.stringify(err));
                return next();
            }
            res.write(file);
            res.end();
            return next();
        });
    }

}
