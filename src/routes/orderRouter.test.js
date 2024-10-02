const request = require("supertest");
const app = require("../service");

const testUser = {
	name: "Robert Tables",
	email: "droptables@school.db",
	password: "sqlInjection",
};
let testUserLoggedInToken;

beforeAll(async () => {
	testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
	const registerRes = await request(app).post("/api/auth").send(testUser);
	testUserAuthToken = registerRes.body.token;
	//TODO make sure that the auth token is signed in, since those are apparently separate.
	const loginResult = await request(app).put("/api/auth").send(testUser);
	testUserLoggedInToken = loginResult.body.token;
});

test("fetch orders", async () => {
	const orderResponse = await request(app)
		.get("/api/order")
		.set("Authorization", `Bearer ${testUserLoggedInToken}`);
	expect(orderResponse.status).toBe(200);
	expect(orderResponse.body.orders).toStrictEqual([]);
});
