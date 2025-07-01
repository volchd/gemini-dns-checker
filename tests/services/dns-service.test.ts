import { checkDnsRegistration } from "../../src/services/dns-service";

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

describe("checkDnsRegistration", () => {
	beforeEach(() => {
		global.fetch = jest.fn();
	});

		it("should return isRegistered: true for a registered domain", async () => {
		(global.fetch as jest.Mock).mockResolvedValueOnce(mockFetchResponse(true, 0, [{ name: "google.com.", type: 1, TTL: 3600, data: "172.217.10.142" }]));

		const result = await checkDnsRegistration("google.com");
		expect(result.isRegistered).toBe(true);
		expect(result.domain).toBe("google.com");
	});

	it("should return isRegistered: false for an unregistered domain", async () => {
		(global.fetch as jest.Mock).mockResolvedValueOnce(mockFetchResponse(true, 3)); // NXDOMAIN

		const result = await checkDnsRegistration("unregistered-domain.com");
		expect(result.isRegistered).toBe(false);
		expect(result.domain).toBe("unregistered-domain.com");
	});

	it("should throw an error if the DoH query fails", async () => {
		(global.fetch as jest.Mock).mockResolvedValueOnce(mockFetchResponse(false, 200));

		await expect(checkDnsRegistration("google.com")).rejects.toThrow(
			"DNS query failed"
		);
	});

	it("should throw an error if the fetch call fails", async () => {
		(global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

		await expect(checkDnsRegistration("google.com")).rejects.toThrow(
			"DNS query failed"
		);
	});
});