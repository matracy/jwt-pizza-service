const request = require("supertest");
const app = require("../service");

const testUser = {
	name: "Robert Tables",
	email: "droptables@school.db",
	password: "sqlInjection",
};
let testUserAuthToken;

beforeAll(async () => {
	testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
	const registerRes = await request(app).post("/api/auth").send(testUser);
	testUserAuthToken = registerRes.body.token;
});

test("ls franchise", async () => {
	const result = await request(app).get("/api/franchise");
	expect(result.status).toBe(200);
	expect(result.body).toBe([]);
});
