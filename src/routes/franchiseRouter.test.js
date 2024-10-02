const request = require("supertest");
const app = require("../service");
const {
	randomName,
	createAdminUser,
	testUser,
	makeTestFranchise,
	createAuthedAdminToken,
	createFranchise,
} = require("./routerTestingHelpers.js");
// let testUserAuthToken;
let testUserLoggedInToken;

beforeAll(async () => {
	testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
	const registerRes = await request(app).post("/api/auth").send(testUser);
	let testUserAuthToken = registerRes.body.token;
	expect(testUserAuthToken).not.toBeNull();
	//TODO make sure that the auth token is signed in, since those are apparently separate.
	const loginResult = await request(app).put("/api/auth").send(testUser);
	testUserLoggedInToken = loginResult.body.token;
});

test("ls franchise", async () => {
	const result = await request(app).get("/api/franchise");
	expect(result.status).toBe(200);
});

test("add delete franchise", async () => {
	//get admin user
	const adminUser = await createAdminUser();
	const loggedInAdminResult = await request(app)
		.put("/api/auth")
		.send(adminUser);
	const adminToken = loggedInAdminResult.body.token;
	//add a franchise
	const addResult = await request(app)
		.post("/api/franchise")
		.set("Authorization", `Bearer ${adminToken}`)
		.send(makeTestFranchise(adminUser));
	expect(addResult.status).toBe(200);
	expect(addResult.body).not.toBe({});
	const franchiseID = addResult.body.id;
	// remove the franchise now that we are done with it.
	const delResult = await request(app)
		.delete(`/api/franchise/${franchiseID}`)
		.set("Authorization", `Bearer ${adminToken}`)
		.send();
	expect(delResult.status).toBe(200);
	expect(delResult.body).toStrictEqual({ message: "franchise deleted" });
});

test("create delete store", async () => {
	//get an admin and authenticate them
	const admin = await createAdminUser();
	const adminToken = await createAuthedAdminToken(admin);
	//get a franchise
	const franchise = await createFranchise(admin, adminToken);
	expect(franchise).not.toBe(false); // Presumably, a non-existant franchise would be falsey
	//create a store
	let testStore = { franchiseID: franchise.id, name: `sotre-${randomName()}` };
	const addResult = await request(app)
		.post(`/api/franchise/${franchise.id}/store`)
		.set("Authorization", `Bearer ${adminToken}`)
		.send(testStore);
	expect(addResult.status).toBe(200);
	expect(addResult.body).not.toBe(false); // Presumably, a non-existant store would be falsey
	//remove the store now that we are done with it
	let removeResult = await request(app)
		.delete(`/api/franchise/${franchise.id}/store/${addResult.body.id}`)
		.set("Authorization", `Bearer ${adminToken}`);
	expect(removeResult.status).toBe(200);
	expect(removeResult.body).toStrictEqual({ message: "store deleted" });
});

test("Delete franchise with wrong user", async () => {
	//get an admin and authenticate them
	const admin = await createAdminUser();
	const adminToken = await createAuthedAdminToken(admin);
	//get a franchise
	const franchise = await createFranchise(admin, adminToken);
	expect(franchise).not.toBe(false); // Presumably, a non-existant franchise would be falsey
	// remove the franchise with the wrong user
	const delResult = await request(app)
		.delete(`/api/franchise/${franchise.id}`)
		.set("Authorization", `Bearer ${testUserLoggedInToken}`)
		.send();
	expect(delResult.status).toBe(403);
});

test("List franchise by user", async () => {
	//get admin user
	let adminUser = await createAdminUser();
	const loggedInAdminResult = await request(app)
		.put("/api/auth")
		.send(adminUser);
	const adminToken = loggedInAdminResult.body.token;
	adminUser.id = loggedInAdminResult.body.user.id;
	expect(adminUser.id).not.toBeUndefined();
	//check for existing franchises
	const preCheckResult = await request(app)
		.get(`/api/franchise/${adminUser.id}`)
		.set("Authorization", `Bearer ${adminToken}`);
	expect(preCheckResult.status).toBe(200);
	expect(preCheckResult.body).toStrictEqual([]);
	//add a franchise
	const addResult = await request(app)
		.post("/api/franchise")
		.set("Authorization", `Bearer ${adminToken}`)
		.send(makeTestFranchise(adminUser));
	expect(addResult.status).toBe(200);
	expect(addResult.body).not.toBe({});
	const postCheckResult = await request(app)
		.get(`/api/franchise/${adminUser.id}`)
		.set("Authorization", `Bearer ${adminToken}`);
	expect(postCheckResult.status).toBe(200);
	expect(postCheckResult.body.length).toBe(1);
});
