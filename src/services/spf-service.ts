import { DnsResponse, SpfRecordObject } from "../types";
import { AppConfig } from "../config";
import { logger } from "../utils/logger";
import { queryDnsRecord } from "./dns-service";

/**
 * Recursively fetches SPF records for a given domain and its included/redirected domains.
 * Prevents infinite loops by tracking visited domains.
 * @param domain The domain to fetch SPF records for.
 * @param visitedDomains A Set to keep track of domains already visited to prevent circular dependencies.
 * @param recordType The type of SPF record being processed (initial, include, or redirect).
 * @param config Configuration object for DNS settings.
 * @returns A promise that resolves to an array of SpfRecordObject.
 * @throws Error if the DNS TXT query fails.
 */
export async function getSpfRecord(domain: string, visitedDomains: Set<string> = new Set(), recordType: 'initial' | 'include' | 'redirect' = 'initial', config: AppConfig): Promise<SpfRecordObject[]> {
	// Check for circular dependencies to prevent infinite loops.
	if (visitedDomains.has(domain)) {
		logger.warn(`Circular dependency detected for domain: ${domain}. Skipping.`, { domain });
		return [];
	}
	// Add the current domain to the set of visited domains.
	visitedDomains.add(domain);

	logger.debug(`Performing SPF record lookup for domain: ${domain}`, { domain, recordType });

	try {
		// Use the robust DNS service for TXT record queries
		const dnsResponse: DnsResponse = await queryDnsRecord(domain, 'TXT', config);
		logger.debug(`DNS TXT query successful for ${domain}`, { domain, status: dnsResponse.Status });

		const spfRecords: SpfRecordObject[] = [];
		// Check if there are any answers in the DNS response.
		if (dnsResponse.Answer) {
			// Iterate over each DNS answer.
			for (const record of dnsResponse.Answer) {
				// Check if the record is a TXT record (type 16) and starts with "v=spf1".
				if (record.type === 16 && record.data.replace(/"/g, '').startsWith("v=spf1")) { // Type 16 is TXT
					let spfRecord = record.data;
					logger.debug(`Found SPF record for ${domain}:`, { domain, spfRecord, type: recordType });
					spfRecords.push({ domain, spfRecord, type: recordType });

					// Handle 'include' mechanisms: recursively fetch SPF records for included domains.
					const includeRegex = /include:([\w.-]+)/g;
					let match;
					while ((match = includeRegex.exec(spfRecord)) !== null) {
						const includedDomain = match[1];
						logger.debug(`Found include mechanism for domain: ${includedDomain}`, { includedDomain, parentDomain: domain });
						const includedSpfRecords = await getSpfRecord(includedDomain, visitedDomains, 'include', config);
						spfRecords.push(...includedSpfRecords);
					}

					// Handle 'redirect' mechanisms: fetch SPF records for the redirected domain.
					const redirectRegex = /redirect=([\w.-]+)/g;
					match = redirectRegex.exec(spfRecord);
					if (match) {
						const redirectedDomain = match[1];
						logger.debug(`Found redirect mechanism for domain: ${redirectedDomain}`, { redirectedDomain, parentDomain: domain });
						const redirectedSpfRecords = await getSpfRecord(redirectedDomain, visitedDomains, 'redirect', config);
						spfRecords.push(...redirectedSpfRecords);
					}
				}
			}
		}
		return spfRecords;
	} catch (error) {
		// Log the error with context and re-throw
		logger.error(`SPF record lookup failed for domain: ${domain}`, error as Error, { domain, recordType });
		throw new Error(`DNS TXT query failed for domain ${domain}: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}
