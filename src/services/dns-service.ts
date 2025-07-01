interface DnsResponse {
	Status: number;
	Answer?: { name: string; type: number; TTL: number; data: string }[];
}

export async function checkDnsRegistration(domain: string) {
	console.log(`Performing DoH lookup for domain: ${domain}`);
	const dohUrl = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(
		domain
	)}`;

	try {
		const response = await fetch(dohUrl, {
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

