import { Context } from "hono";
import { checkDns } from "../../src/controllers/dns-controller";
import * as dnsService from "../../src/services/dns-service";

// Mock the dns-service
jest.mock("../../src/services/dns-service");

describe("checkDns controller", () => {
	let c: Context;

	// Helper to create a mock Hono Context
	const createMockContext = (queryValue?: string) => {
		const mockQuery = jest.fn().mockReturnValue(queryValue);
		const mockJson = jest.fn();
		return {
			req: { query: mockQuery },
			json: mockJson,
		} as unknown as Context;
	};

	// Helper to mock dnsService.checkDnsRegistration
	const mockDnsServiceResult = (result: any) => (dnsService.checkDnsRegistration as jest.Mock).mockResolvedValue(result);
	const mockDnsServiceError = (error: Error) => (dnsService.checkDnsRegistration as jest.Mock).mockRejectedValue(error);

	beforeEach(() => {
		// Reset mocks before each test
		jest.clearAllMocks();
		// Initialize a fresh mock Hono context for each test
		c = createMockContext();
	});

	it("should return a 400 error if the domain parameter is missing", async () => {
		(c.req.query as jest.Mock).mockReturnValue(undefined); // Directly mock query for this specific test
		await checkDns(c);
		expect(c.json).toHaveBeenCalledWith({ error: "Domain parameter is required" }, 400);
	});

	it("should return a 400 error for an invalid domain format", async () => {
		(c.req.query as jest.Mock).mockReturnValue("invalid-domain"); // Directly mock query for this specific test
		await checkDns(c);
		expect(c.json).toHaveBeenCalledWith({ error: "Invalid domain format" }, 400);
	});

	it("should call the DNS service and return the result for a valid domain", async () => {
		const mockResult = { domain: "google.com", isRegistered: true };
		(c.req.query as jest.Mock).mockReturnValue("google.com"); // Directly mock query for this specific test
		mockDnsServiceResult(mockResult);

		await checkDns(c);

		expect(dnsService.checkDnsRegistration).toHaveBeenCalledWith("google.com");
		expect(c.json).toHaveBeenCalledWith(mockResult);
	});

	it("should return a 500 error if the DNS service throws an error", async () => {
		(c.req.query as jest.Mock).mockReturnValue("google.com"); // Directly mock query for this specific test
		mockDnsServiceError(new Error("Service error"));

		await checkDns(c);

		expect(c.json).toHaveBeenCalledWith({ error: "Service error" }, 500);
	});
});