const config = require("./config.js");

function sendLogToGrafana(msg) {
	console.log(msg); //FIXME make this actually point to grafana
}

function logSQLQuery(query, params) {
	//TODO work in parameters
	const logMessage = {
		streams: [
			{
				stream: {
					component: config.logging.source,
					label: "Database",
					Level: "info",
				},
				values: [[Date.now(), query]],
			},
		],
	};
	sendLogToGrafana(logMessage);
}

function logFactoryServiceRequest(orderInfo) {
	const logMessage = {
		streams: [
			{
				stream: {
					component: config.logging.source,
					label: "Factory",
					Level: "info",
				},
				values: [[Date.now(), orderInfo]],
			},
		],
	};
	sendLogToGrafana(logMessage);
}

function logException(err, req, res, next) {
	const logMessage = {
		streams: [
			{
				stream: {
					component: config.logging.source,
					label: "Unhandled Errors",
					Level: "error",
				},
				values: [
					[
						Date.now(),
						{ message: err.message, status: err.statusCode },
						{
							Method: req.method,
							Endpoint: req.url,
							ip: req.ip,
						},
					],
				],
			},
		],
	};
	sendLogToGrafana(logMessage);
	next();
}

function sanatizeHTTPBody(body) {
	// Taken with minor modifications from https://www.npmjs.com/package/pizza-logger
	var replacementBody = JSON.stringify(body);
	replacementBody = replacementBody.replace(
		/\\"password\\":\s*\\"[^"]*\\"/g,
		'\\"password\\": \\"*****\\"',
	);
	replacementBody = replacementBody.replace(
		/\\password\\=\s*\\"[^"]*\\"/g,
		'\\"password\\": \\"*****\\"',
	);
	return JSON.parse(replacementBody);
}

function logHTTPRequestResponse(req, res, next) {
	//simple bookkeeping
	const endpoint = req.url;
	const method = req.method;
	const cleanRequestBody = sanatizeHTTPBody(req.body);
	const hasAuthHeader = "Authorization" in req.headers;
	const ip = req.ip;
	//Prepare for some arcane espionage as guided by https://stackoverflow.com/questions/57551635/how-to-get-response-body-in-middleware
	//The basic idea is that res.json() is part of the response chain, so if we overload it with our own lambda, we can run after the
	//response has been decided, thus allowing us to capture it for logging despire the middleware having already finished execution.
	const oldJSON = res.json;
	res.json = async (value) => {
		const rawResponseBody = await Promise.resolve(value);
		const cleanResponseBody = sanatizeHTTPBody(rawResponseBody);
		const status = res.status;
		const logEntry = JSON.stringify({
			request: cleanRequestBody,
			response: cleanResponseBody,
		});
		const logMessage = {
			streams: [
				{
					stream: {
						component: config.logging.source,
						label: "HTTP Requests",
						Level: status >= 500 ? "error" : status >= 400 ? "warn" : "info",
					},
					values: [
						[
							Date.now(),
							logEntry,
							{
								Method: method,
								Endpoint: endpoint,
								ip: ip,
							},
						],
					],
				},
			],
		};
		sendLogToGrafana(logMessage);
		return oldJSON.call(res, rawResponseBody);
	};
	//Now that we have injected logging to the request, let everyone else have a turn with it.
	next();
}

module.exports = {
	logSQLQuery,
	logFactoryServiceRequest,
	logException,
	logHTTPRequestResponse,
};
