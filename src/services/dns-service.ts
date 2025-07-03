import { DnsResponse } from "../types";
import { dohUrl } from "../config";

/**
 * Checks the DNS registration status of a given domain using a DNS over HTTPS (DoH) service.
 * @param domain The domain name to check.
 * @returns An object containing the domain, its registration status, and the full DoH response.
 * @throws Error if the DNS query fails or returns an unexpected status.
 */
export async function checkDnsRegistration(domain: string) {
	console.log(`Performing DoH lookup for domain: ${domain}`);
	// Construct the DoH URL with the domain name.
	const url = `${dohUrl}?name=${encodeURIComponent(domain)}`;

	try {
		// Make a fetch request to the DoH service.
		const response = await fetch(url, {
			headers: {
				Accept: "application/dns-json", // Request DNS-JSON format
			},
		});

		// If the HTTP response is not OK, log an error and throw.
		if (!response.ok) {
			console.error(`DoH query failed with status: ${response.status}`);
			throw new Error("DNS query failed");
		}

		// Parse the JSON response from the DoH service.
		const dnsResponse: DnsResponse = await response.json();
		console.log(`DoH response for ${domain}:`, dnsResponse);

		// Determine if the domain is registered based on the DNS response status.
		// A status of 3 (NXDOMAIN) indicates the domain does not exist.
		const isRegistered = dnsResponse.Status !== 3;
		console.log(`Domain ${domain} is ${isRegistered ? 'registered' : 'not registered'}`);

		// Return the structured result.
		return {
			domain,
			isRegistered,
			dnsResponse,
		};
	} catch (error) {
		// Catch and re-throw any errors that occur during the fetch operation.
		console.error("DoH request failed:", error);
		throw new Error("DNS query failed");
	}
}



