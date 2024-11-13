const config = require("./config.js");
const os = require("os");

function getCpuUsagePercentage() {
	const cpuUsage = os.loadavg()[0] / os.cpus().length;
	return cpuUsage.toFixed(2) * 100;
}

function getMemoryUsagePercentage() {
	const totalMemory = os.totalmem();
	const freeMemory = os.freemem();
	const usedMemory = totalMemory - freeMemory;
	const memoryUsage = (usedMemory / totalMemory) * 100;
	return memoryUsage.toFixed(2);
}

//copied from https://stackoverflow.com/questions/37318808/what-is-the-in-place-alternative-to-array-prototype-filter
function filterInPlace(a, condition, thisArg) {
	let j = 0;

	a.forEach((e, i) => {
		if (condition.call(thisArg, e, i, a)) {
			if (i !== j) a[j] = e;
			j++;
		}
	});

	a.length = j;
	return a;
}

class Metrics {
	constructor() {
		this.statistics = {
			http: { PUT: 0, POST: 0, GET: 0, DELETE: 0 },
			users: 0,
			purchase: [],
			auth: { passed: 0, failed: 0 },
		};

		this.reportingPeriod = 10000;

		// This will periodically sent metrics to Grafana
		const timer = setInterval(() => {
			try {
				this.sendHttpMetrics();
				this.sendSystemMetrics();
				this.sendUserMetrics();
				this.sendPurchaseMetrics();
				this.sendAuthMetrics();
			} catch (error) {
				console.log("Error sending metrics", error);
			}
		}, this.reportingPeriod);

		timer.unref(); //don't hold things open if this is the only timer in the module that hasn't fired yet
	}

	noteHTTP(method) {
		this.statistics.http[method] += 1;
	}

	addUser() {
		this.statistics.users += 1;
	}

	removeUser() {
		this.statistics.users -= 1;
	}

	noteAuth(passed) {
		if (passed) {
			this.statistics.auth.passed += 1;
			this.statistics.users += 1;
		} else {
			this.statistics.auth.failed += 1;
		}
	}

	noteSale(numPizzas, success, value, hqTime, totalTime) {
		this.statistics.purchase.push({
			numItems: numPizzas,
			success: success,
			transactionAmount: value,
			hqTime: hqTime,
			totalTime: totalTime,
			hasBeenCounted: false,
		});
	}

	sendHttpMetrics() {
		var totalRequests =
			this.statistics.http.DELETE +
			this.statistics.http.GET +
			this.statistics.http.PUT +
			this.statistics.http.POST;

		this.sendMetricToGrafana(
			`request,source=${config.metrics.source},method=all total=${totalRequests}`,
		);
		this.sendMetricToGrafana(
			`request,source=${config.metrics.source},method=GET total=${this.statistics.http.GET}`,
		);
		this.sendMetricToGrafana(
			`request,source=${config.metrics.source},method=DELETE total=${this.statistics.http.DELETE}`,
		);
		this.sendMetricToGrafana(
			`request,source=${config.metrics.source},method=PUT total=${this.statistics.http.PUT}`,
		);
		this.sendMetricToGrafana(
			`request,source=${config.metrics.source},method=POST total=${this.statistics.http.POST}`,
		);
	}

	sendSystemMetrics() {
		this.sendMetricToGrafana(
			`system,source=${config.metrics.source} CPU=${getCpuUsagePercentage()}`,
		);
		this.sendMetricToGrafana(
			`system,source=${config.metrics.source} MEM=${getMemoryUsagePercentage()}`,
		);
	}

	sendUserMetrics() {
		this.sendMetricToGrafana(
			`activeUsers,source=${config.metrics.source} numActiveUsers=${this.statistics.users}`,
		);
	}

	sendPurchaseMetrics() {
		var numSold = 0;
		var totalRevenue = 0;
		var numFailures = 0;
		var totalHQTime = 0;
		var totalElapsedTime = 0;
		this.statistics.purchase.forEach((trans) => {
			numSold += trans.numItems;
			if (!trans.success) {
				numFailures += 1;
			}
			totalRevenue += trans.transactionAmount;
			totalHQTime += trans.hqTime;
			totalElapsedTime += trans.totalTime;
			trans.hasBeenCounted = true;
		});

		filterInPlace(this.statistics.purchase, (trans) => {
			return !trans.hasBeenCounted;
		});

		this.sendMetricToGrafana(
			`sales,source=${config.metrics.source} unitsSold=${numSold}`,
		);
		this.sendMetricToGrafana(
			`sales,source=${config.metrics.source} totalRevenue=${totalRevenue}`,
		);
		this.sendMetricToGrafana(
			`sales,source=${config.metrics.source} creationErrors=${numFailures}`,
		);
		this.sendMetricToGrafana(
			`latency,source=${config.metrics.source} HQ-delay=${totalHQTime / this.reportingPeriod}`,
		);
		this.sendMetricToGrafana(
			`latency,source=${config.metrics.source} elapsedTime=${totalElapsedTime / this.reportingPeriod}`,
		);
	}

	sendAuthMetrics() {
		this.sendMetricToGrafana(
			`auth,source=${config.metrics.source} Pass=${this.statistics.auth.passed}`,
		);
		this.sendMetricToGrafana(
			`auth,source=${config.metrics.source} Fail=${this.statistics.auth.failed}`,
		);
	}

	sendMetricToGrafana(metric) {
		fetch(`${config.metrics.url}`, {
			method: "post",
			body: metric,
			headers: {
				Authorization: `Bearer ${config.metrics.userId}:${config.metrics.apiKey}`,
			},
		})
			.then((response) => {
				if (!response.ok) {
					console.error(
						`Failed to push metrics data to Grafana.  Got response ${response.status} for metric ${metric}`,
					);
				} else {
					console.log(`Pushed ${metric}`);
				}
			})
			.catch((error) => {
				console.error("Error pushing metrics:", error);
			});
	}

	trackRequest(req, res, next) {
		this.noteHTTP(req.method);
		req._metricsStartTime = Date.now();
		next();
	}
}

const metrics = new Metrics();

const requestTracker = (req, res, next) => {
	metrics.trackRequest(req, res, next);
};

const measureAuth = (isLogout, passed) => {
	if (isLogout) {
		metrics.removeUser();
	} else {
		metrics.noteAuth(passed);
	}
};

const measureOrder = (success, order, startTime, HQStartTime, now) => {
	var value = 0;
	order.items.forEach((item) => {
		value += item.price;
	});
	var numPizzas = order.items.length;
	this.noteSale(numPizzas, success, value, now - HQStartTime, now - startTime);
};

module.exports = { requestTracker, measureAuth, measureOrder };
