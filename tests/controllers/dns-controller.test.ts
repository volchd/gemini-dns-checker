
import { Context } from "hono";
import { checkDns } from "../../src/controllers/dns-controller";
import * as dnsService from "../../src/services/dns-service";

// Mock the dns-service
jest.mock("../../src/services/dns-service");

describe("checkDns controller", () => {
	let c: Context;

	beforeEach(() => {
		// Reset mocks before each test
		jest.clearAllMocks();

		// Mock Hono context
		c = {
			req: {
				query: jest.fn(),
			},
			json: jest.fn(),
		} as unknown as Context;
	});

	it("should return a 400 error if the domain parameter is missing", async () => {
		(c.req.query as jest.Mock).mockReturnValue(undefined);
		await checkDns(c);
		expect(c.json).toHaveBeenCalledWith({ error: "Domain parameter is required" }, 400);
	});

	it("should return a 400 error for an invalid domain format", async () => {
		(c.req.query as jest.Mock).mockReturnValue("invalid-domain");
		await checkDns(c);
		expect(c.json).toHaveBeenCalledWith({ error: "Invalid domain format" }, 400);
	});

	it("should call the DNS service and return the result for a valid domain", async () => {
		const mockResult = { domain: "google.com", isRegistered: true };
		(c.req.query as jest.Mock).mockReturnValue("google.com");
		(dnsService.checkDnsRegistration as jest.Mock).mockResolvedValue(mockResult);

		await checkDns(c);

		expect(dnsService.checkDnsRegistration).toHaveBeenCalledWith("google.com");
		expect(c.json).toHaveBeenCalledWith(mockResult);
	});

	it("should return a 500 error if the DNS service throws an error", async () => {
		(c.req.query as jest.Mock).mockReturnValue("google.com");
		(dnsService.checkDnsRegistration as jest.Mock).mockRejectedValue(
			new Error("Service error")
		);

		await checkDns(c);

		expect(c.json).toHaveBeenCalledWith({ error: "Service error" }, 500);
	});
});
