interface DnsResponse {
	Status: number;
	Answer?: { name: string; type: number; TTL: number; data: string }[];
}

export async function getSpfRecord(domain: string, visitedDomains: Set<string> = new Set()): Promise<string | null> {
	if (visitedDomains.has(domain)) {
		console.log(`Circular dependency detected for domain: ${domain}. Skipping.`);
		return null;
	}
	visitedDomains.add(domain);

	console.log(`Performing SPF record lookup for domain: ${domain}`);
	const dohUrl = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(
		domain
	)}&type=TXT`;

	try {
		const response = await fetch(dohUrl, {
			headers: {
				Accept: "application/dns-json",
			},
		});

		if (!response.ok) {
			console.error(`DoH query for TXT records failed with status: ${response.status}`);
			throw new Error("DNS TXT query failed");
		}

		const dnsResponse: DnsResponse = await response.json();
		console.log(`DoH TXT response for ${domain}:`, dnsResponse);

		if (dnsResponse.Answer) {
			for (const record of dnsResponse.Answer) {
				if (record.type === 16 && record.data.replace(/"/g, '').startsWith("v=spf1")) { // Type 16 is TXT
					let spfRecord = record.data;

					// Handle includes
					const includeRegex = /include:([\w.-]+)/g;
					let match;
					while ((match = includeRegex.exec(spfRecord)) !== null) {
						const includedDomain = match[1];
						console.log(`Found include mechanism for domain: ${includedDomain}`);
						const includedSpf = await getSpfRecord(includedDomain, visitedDomains);
						if (includedSpf) {
							return includedSpf;
						} else {
							return null; // If an included domain has no SPF, the resolution fails.
						}
					}

					// Handle redirects
					const redirectRegex = /redirect=([\w.-]+)/g;
					match = redirectRegex.exec(spfRecord);
					if (match) {
						const redirectedDomain = match[1];
						console.log(`Found redirect mechanism for domain: ${redirectedDomain}`);
						const redirectedSpf = await getSpfRecord(redirectedDomain, visitedDomains);
						if (redirectedSpf) {
							return redirectedSpf;
						} else {
							return null; // If a redirected domain has no SPF, the resolution fails.
						}
					}
					return spfRecord;
				}
			}
		}
		return null;
	} catch (error) {
		console.error("DoH TXT request failed:", error);
		throw new Error("DNS TXT query failed");
	}
}
