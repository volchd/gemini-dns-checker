
import { checkDnsRegistration } from "../../src/services/dns-service";

// Mock the global fetch function
global.fetch = jest.fn();

describe("checkDnsRegistration", () => {
	beforeEach(() => {
		(global.fetch as jest.Mock).mockClear();
	});

	it("should return isRegistered: true for a registered domain", async () => {
		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				Status: 0,
				Answer: [{ name: "google.com.", type: 1, TTL: 3600, data: "172.217.10.142" }],
			}),
		});

		const result = await checkDnsRegistration("google.com");
		expect(result.isRegistered).toBe(true);
		expect(result.domain).toBe("google.com");
	});

	it("should return isRegistered: false for an unregistered domain", async () => {
		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				Status: 3, // NXDOMAIN
			}),
		});

		const result = await checkDnsRegistration("unregistered-domain.com");
		expect(result.isRegistered).toBe(false);
		expect(result.domain).toBe("unregistered-domain.com");
	});

	it("should throw an error if the DoH query fails", async () => {
		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: false,
		});

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
