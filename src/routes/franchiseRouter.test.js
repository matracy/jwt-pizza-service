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
		name: "SQL Pizza",
		admins: [{ email: admn.email }],
	};
}
let testUserAuthToken;
let testUserLoggedInToken;

beforeAll(async () => {
	testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
	const registerRes = await request(app).post("/api/auth").send(testUser);
	testUserAuthToken = registerRes.body.token;
	//TODO make sure that the auth token is signed in, since those are apparently separate.
	const loginResult = await request(app).put("/api/auth").send(testUser);
	testUserLoggedInToken = loginResult.body.token;
});

test("ls franchise", async () => {
	const result = await request(app).get("/api/franchise");
	expect(result.status).toBe(200);
	expect(result.body).toStrictEqual([]);
});

test("add delete franchise", async () => {
	//get admin user
	const adminUser = await createAdminUser();
	const loggedInAdminResult = await request(app)
		.put("/api/auth")
		.send(adminUser);
	const adminToken = loggedInAdminResult.body.token;
	console.log(`Admin token: ${adminToken}`);
	//add a franchise
	const addResult = await request(app)
		.post("/api/franchise")
		.set("Authorization", `Bearer ${adminToken}`)
		.send(makeTestFranchise(adminUser)); //FIXME need to add admin user as admin before submitting franchise
	console.log(
		`Attempt to add franchise gave ${addResult.status} with body `,
		addResult.body,
	);
	expect(addResult.status).toBe(200);
	expect(addResult.body).not.toBe({});
	//remove the franchise now that we are done with it.
	// const delResult = await request(app)
	// 	.delete("/api/franchise")
	// 	.set("Authorization", `Bearer ${adminToken}`)
	// 	.send();
	// expect(delResult.status).toBe(200);
	// expect(delResult.body).toBe({ message: "franchise deleted" });
});
