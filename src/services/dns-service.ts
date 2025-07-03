import { DnsResponse } from "../types";
import { dohUrl } from "../config";

export async function checkDnsRegistration(domain: string) {
	console.log(`Performing DoH lookup for domain: ${domain}`);
	const url = `${dohUrl}?name=${encodeURIComponent(domain)}`;

	try {
		const response = await fetch(url, {
			headers: {
				Accept: "application/dns-json",
			},
		});

		if (!response.ok) {
			console.error(`DoH query failed with status: ${response.status}`);
			throw new Error("DNS query failed");
		}

		const dnsResponse: DnsResponse = await response.json();
		console.log(`DoH response for ${domain}:`, dnsResponse);

		// A status of 3 (NXDOMAIN) means the domain does not exist.
		const isRegistered = dnsResponse.Status !== 3;
		console.log(`Domain ${domain} is ${isRegistered ? 'registered' : 'not registered'}`);

		return {
			domain,
			isRegistered,
			dnsResponse,
		};
	} catch (error) {
		console.error("DoH request failed:", error);
		throw new Error("DNS query failed");
	}
}



