import { DnsResponse, SpfRecordObject } from "../types";
import { dohUrl } from "../config";

/**
 * Recursively fetches SPF records for a given domain and its included/redirected domains.
 * Prevents infinite loops by tracking visited domains.
 * @param domain The domain to fetch SPF records for.
 * @param visitedDomains A Set to keep track of domains already visited to prevent circular dependencies.
 * @param recordType The type of SPF record being processed (initial, include, or redirect).
 * @returns A promise that resolves to an array of SpfRecordObject.
 * @throws Error if the DNS TXT query fails.
 */
export async function getSpfRecord(domain: string, visitedDomains: Set<string> = new Set(), recordType: 'initial' | 'include' | 'redirect' = 'initial'): Promise<SpfRecordObject[]> {
	// Check for circular dependencies to prevent infinite loops.
	if (visitedDomains.has(domain)) {
		console.log(`Circular dependency detected for domain: ${domain}. Skipping.`);
		return [];
	}
	// Add the current domain to the set of visited domains.
	visitedDomains.add(domain);

	console.log(`Performing SPF record lookup for domain: ${domain}`);
	// Construct the DoH URL for TXT records.
	const url = `${dohUrl}?name=${encodeURIComponent(domain)}&type=TXT`;

	try {
		// Make a fetch request to the DoH service for TXT records.
		const response = await fetch(url, {
			headers: {
				Accept: "application/dns-json", // Request DNS-JSON format
			},
		});

		// If the HTTP response is not OK, log an error and throw.
		if (!response.ok) {
			console.error(`DoH query for TXT records failed with status: ${response.status}`);
			throw new Error("DNS TXT query failed");
		}

		// Parse the JSON response from the DoH service.
		const dnsResponse: DnsResponse = await response.json();
		//console.log(`DoH TXT response for ${domain}:`, dnsResponse);

		const spfRecords: SpfRecordObject[] = [];
		// Check if there are any answers in the DNS response.
		if (dnsResponse.Answer) {
			// Iterate over each DNS answer.
			for (const record of dnsResponse.Answer) {
				// Check if the record is a TXT record (type 16) and starts with "v=spf1".
				if (record.type === 16 && record.data.replace(/"/g, '').startsWith("v=spf1")) { // Type 16 is TXT
					let spfRecord = record.data;
					console.log(`DoH TXT response for ${domain}:`, record);
										spfRecords.push({ domain, spfRecord, type: recordType });

					// Handle 'include' mechanisms: recursively fetch SPF records for included domains.
					const includeRegex = /include:([\w.-]+)/g;
					let match;
					while ((match = includeRegex.exec(spfRecord)) !== null) {
						const includedDomain = match[1];
						console.log(`Found include mechanism for domain: ${includedDomain}`);
						const includedSpfRecords = await getSpfRecord(includedDomain, visitedDomains, 'include');
						spfRecords.push(...includedSpfRecords);
					}

					// Handle 'redirect' mechanisms: fetch SPF records for the redirected domain.
					const redirectRegex = /redirect=([\w.-]+)/g;
					match = redirectRegex.exec(spfRecord);
					if (match) {
						const redirectedDomain = match[1];
						console.log(`Found redirect mechanism for domain: ${redirectedDomain}`);
						const redirectedSpfRecords = await getSpfRecord(redirectedDomain, visitedDomains, 'redirect');
						spfRecords.push(...redirectedSpfRecords);
					}
				}
			}
		}
		return spfRecords;
	} catch (error) {
		// Catch and re-throw any errors that occur during the fetch operation.
		console.error("DoH TXT request failed:", error);
		throw new Error("DNS TXT query failed");
	}
}
