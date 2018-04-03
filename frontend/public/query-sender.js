/**
 * Receives a query object as parameter and sends it as Ajax request to the POST /query REST endpoint.
 *
 * @param query The query object
 * @returns {Promise} Promise that must be fulfilled if the Ajax request is successful and be rejected otherwise.
 */
CampusExplorer.sendQuery = function(query) {
    return new Promise(function(fulfill, reject) {
        // TODO: implement!
        let json = JSON.stringify(query);
        let xmlRequest = new XMLHttpRequest();
        xmlRequest.open("POST", "/query", true);
        xmlRequest.onload = function () {
            if (this.status === 200) {
                fulfill(this.response);
            } else {
                reject(this.response);
            }
        };
        xmlRequest.send(json);
    });
};
