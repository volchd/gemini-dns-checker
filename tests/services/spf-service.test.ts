import { getSpfRecord } from "../../src/services/spf-service";

// Mock the global fetch function
global.fetch = jest.fn();

const mockFetchResponse = (ok: boolean, Status: number, Answer?: any[]) =>
	Promise.resolve({
		ok,
		json: async () => ({
			Status,
			Answer,
		}),
	});

describe("getSpfRecord", () => {
	beforeEach(() => {
		global.fetch = jest.fn();
	});

		it("should return the SPF record for a domain", async () => {
		(global.fetch as jest.Mock)
			.mockResolvedValueOnce(mockFetchResponse(true, 0, [{ type: 16, data: "v=spf1 include:_spf.google.com ~all" }]))
			.mockResolvedValueOnce(mockFetchResponse(true, 0, [{ type: 16, data: "v=spf1 ip4:1.2.3.4 ~all" }])); // Mock for _spf.google.com

		const spfRecord = await getSpfRecord("example.com");
		expect(spfRecord).toBe("v=spf1 ip4:1.2.3.4 ~all");
	});

	it("should return null if no SPF record is found", async () => {
		(global.fetch as jest.Mock).mockResolvedValueOnce(mockFetchResponse(true, 0, [{ type: 16, data: "v=DKIM1 p=somekey" }]));

		const spfRecord = await getSpfRecord("example.com");
		expect(spfRecord).toBeNull();
	});

	it("should handle included SPF records recursively", async () => {
		// First call for example.com
		(global.fetch as jest.Mock)
			.mockResolvedValueOnce(mockFetchResponse(true, 0, [{ type: 16, data: "v=spf1 include:sub.example.com ~all" }]))
			.mockResolvedValueOnce(mockFetchResponse(true, 0, [{ type: 16, data: "v=spf1 ip4:192.0.2.1 -all" }]));

		const spfRecord = await getSpfRecord("example.com");
		expect(spfRecord).toBe("v=spf1 ip4:192.0.2.1 -all");
	});

	it("should handle redirected SPF records recursively", async () => {
		// First call for example.com
		(global.fetch as jest.Mock)
			.mockResolvedValueOnce(mockFetchResponse(true, 0, [{ type: 16, data: "v=spf1 redirect=redirect.example.com" }]))
			.mockResolvedValueOnce(mockFetchResponse(true, 0, [{ type: 16, data: "v=spf1 ip4:192.0.2.2 +all" }]));

		const spfRecord = await getSpfRecord("example.com");
		expect(spfRecord).toBe("v=spf1 ip4:192.0.2.2 +all");
	});

	it("should return null if included domain has no SPF record", async () => {
		// First call for example.com
		(global.fetch as jest.Mock)
			.mockResolvedValueOnce(mockFetchResponse(true, 0, [{ type: 16, data: "v=spf1 include:no-spf.example.com ~all" }]))
			.mockResolvedValueOnce(mockFetchResponse(true, 0, [])); // No SPF record

		const spfRecord = await getSpfRecord("example.com");
		expect(spfRecord).toBeNull();
	});

	it("should return null if redirected domain has no SPF record", async () => {
		// First call for example.com
		(global.fetch as jest.Mock)
			.mockResolvedValueOnce(mockFetchResponse(true, 0, [{ type: 16, data: "v=spf1 redirect=no-spf.example.com" }]))
			.mockResolvedValueOnce(mockFetchResponse(true, 0, [])); // No SPF record

		const spfRecord = await getSpfRecord("example.com");
		expect(spfRecord).toBeNull();
	});

	it("should throw an error if the DoH query for TXT records fails", async () => {
		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: false,
			json: async () => ({}),
		});

		await expect(getSpfRecord("example.com")).rejects.toThrow(
			"DNS TXT query failed"
		);
	});

		it("should throw an error if the fetch call fails", async () => {
		(global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

		await expect(getSpfRecord("example.com")).rejects.toThrow(
			"DNS TXT query failed"
		);
	});
});