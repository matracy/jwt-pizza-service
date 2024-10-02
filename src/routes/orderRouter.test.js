const request = require("supertest");
const app = require("../service");
const {
	randomName,
	createAdminUser,
	testUser,
	createAuthedAdminToken,
} = require("./routerTestingHelpers.js");

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

test("fetch orders", async () => {
	const orderResponse = await request(app)
		.get("/api/order")
		.set("Authorization", `Bearer ${testUserLoggedInToken}`);
	expect(orderResponse.status).toBe(200);
	expect(orderResponse.body.orders).toStrictEqual([]);
});

test("place empty order", async () => {
	let testOrder = { items: [] };
	const orderResponse = await request(app)
		.post("/api/order")
		.set("Authorization", `Bearer ${testUserLoggedInToken}`)
		.send(testOrder);
	expect(orderResponse.status).toBe(500);
});

test("order from bad franchise", async () => {
	let testOrder = { franchiseID: -1, items: [] };
	const orderResponse = await request(app)
		.post("/api/order")
		.set("Authorization", `Bearer ${testUserLoggedInToken}`)
		.send(testOrder);
	expect(orderResponse.status).toBe(500);
});

test("Order without authentication", async () => {
	let testOrder = { items: [] };
	const orderResponse = await request(app)
		.post("/api/order")
		.set("Authorization", "Bearer badTokenDoesNotExist")
		.send(testOrder);
	expect(orderResponse.status).toBe(401);
});

test("get menu", async () => {
	const menuResponse = await request(app).get("/api/order/menu");
	expect(menuResponse.status).toBe(200);
});

test("add menu item", async () => {
	//get an admin authed token
	const adminUser = await createAdminUser();
	expect(adminUser).not.toBeUndefined();
	const authedAdminToken = await createAuthedAdminToken(adminUser);
	expect(authedAdminToken).not.toBeUndefined();
	//add new menu item
	const newItem = {
		title: `The poison [${randomName()} edition]`,
		description:
			"Kuzco's poison.  The poison specially chosen to kill Kuzco.  That poison?",
		image: "vial.png",
		price: 0.0001,
	};
	const addResponse = await request(app)
		.put("/api/order/menu")
		.set("Authorization", `Bearer ${authedAdminToken}`)
		.send(newItem);
	expect(addResponse.status).toBe(200);
	expect(addResponse.body).not.toStrictEqual([]);
	//remove menu item
});
