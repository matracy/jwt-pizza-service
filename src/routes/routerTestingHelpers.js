const request = require("supertest");
const app = require("../service");
const { Role, DB } = require("../database/database.js");

function randomName() {
	return Math.random().toString(36).substring(2, 12);
}

async function createAdminUser() {
	let user = { password: "toomanysecrets", roles: [{ role: Role.Admin }] };
	user.name = randomName();
	user.email = user.name + "@admin.com";

	await DB.addUser(user);

	user.password = "toomanysecrets";
	return user;
}

const testUser = {
	name: "Robert Tables",
	email: "droptables@school.db",
	password: "sqlInjection",
};

function makeTestFranchise(admn) {
	return {
		name: `SQL Pizza - ${randomName()} edition.`,
		admins: [{ email: admn.email }],
	};
}

async function createAuthedAdminToken(adminUser) {
	const loggedInAdminResult = await request(app)
		.put("/api/auth")
		.send(adminUser);
	if (loggedInAdminResult.body.token == undefined) {
		console.log(
			"Admin user ",
			adminUser,
			` Could not be authed.  got ${loggedInAdminResult.status}: `,
			loggedInAdminResult.body,
		);
	}
	return loggedInAdminResult.body.token;
}

async function createFranchise(adminUser, adminToken) {
	//add a franchise
	const addResult = await request(app)
		.post("/api/franchise")
		.set("Authorization", `Bearer ${adminToken}`)
		.send(makeTestFranchise(adminUser));
	return addResult.body;
}

module.exports = {
	randomName,
	createAdminUser,
	testUser,
	makeTestFranchise,
	createAuthedAdminToken,
	createFranchise,
};
