const config = require("./config.js");

function sendLogToGrafana(msg) {
	const body = JSON.stringify(msg);
	fetch(`${config.logging.url}`, {
		method: "post",
		body: body,
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${config.logging.userId}:${config.logging.apiKey}`,
		},
	})
		.then((response) => {
			if (!response.ok) {
				console.error(
					`Failed to push log entry to Grafana.  Got response ${response.status}: ${JSON.stringify(response.body)} for metric ${body}`,
				);
			} else {
				console.log(`Loged ${body}`);
			}
		})
		.catch((error) => {
			console.error("Error pushing metrics:", error);
		});
}

function logSQLQuery(query) {
	//TODO work in parameters
	const logMessage = {
		streams: [
			{
				stream: {
					component: config.logging.source,
					label: "Database",
					Level: "info",
				},
				values: [[`${Math.floor(Date.now()) * 1000000}`, query]],
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
				values: [
					[
						`${Math.floor(Date.now()) * 1000000}`,
						`${JSON.stringify(orderInfo)}`,
					],
				],
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
						`${Math.floor(Date.now()) * 1000000}`,
						`${JSON.stringify({ message: err.message, status: err.statusCode })}`,
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
	let isString = (value) => typeof value === "string";
	var replacementBody = "";
	if (isString(body)) {
		replacementBody = body;
	} else {
		replacementBody = JSON.stringify(body);
	}
	// Taken with minor modifications from https://www.npmjs.com/package/pizza-logger
	console.log("Sanatizing body.");
	replacementBody = replacementBody.replace(
		/\\"password\\":\s*\\"[^"]*\\"/g,
		'\\"password\\": \\"*****\\"',
	);
	console.log("First pass sanitization done.");
	replacementBody = replacementBody.replace(
		/\\password\\=\s*\\"[^"]*\\"/g,
		'\\"password\\": \\"*****\\"',
	);
	console.log("Second pass sanitization done.");
	return replacementBody;
}

function logHTTPRequestResponse(req, res, next) {
	//simple bookkeeping
	const endpoint = req.url;
	const method = req.method;
	const cleanRequestBody = sanatizeHTTPBody(
		req.body === null || req.body === undefined ? {} : req.body,
	);
	const hasAuthHeader = "Authorization" in req.headers;
	const ip = req.ip;

	//Prepare for some arcane espionage as guided by https://stackoverflow.com/questions/57551635/how-to-get-response-body-in-middleware
	//The basic idea is that res.json() is part of the response chain, so if we overload it with our own lambda, we can run after the
	//response has been decided, thus allowing us to capture it for logging despire the middleware having already finished execution.

	function injectableLogger(bodyToSend) {
		const cleanResponseBody = sanatizeHTTPBody(bodyToSend);
		const status = res.status;
		const logEntry = `{
			"request": ${cleanRequestBody},
			"response": ${cleanResponseBody},
		}`;

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
							`${Math.floor(Date.now()) * 1000000}`,
							`${logEntry}`,
							{
								Method: method,
								Endpoint: endpoint,
								ip: ip,
								hasAuthHeader: `${hasAuthHeader}`,
							},
						],
					],
				},
			],
		};
		sendLogToGrafana(logMessage);
	}

	// const oldSend = res.send;
	const oldSend = res.send.bind(res);
	res.send = (bodyToSend) => {
		injectableLogger(bodyToSend);
		return oldSend.call(res, bodyToSend);
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
