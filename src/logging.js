const config = require("./config.js");

function sendLogToGrafana(msg) {
	//
}

function logSQLQuery() {
	//
}

function logFactoryServiceRequest() {
	//
}

function logException() {
	//TODO make this the top-level express middleware
}

function logHTTPRequestResponse(req, res) {
	//NOTE: This should not be middleware.
}

module.exports = {
	logSQLQuery,
	logFactoryServiceRequest,
	logException,
	logHTTPRequestResponse,
};
