import { DnsService } from './dns-service';
import { 
    DkimRecord, 
    DkimRecordSet, 
    DkimValidationResult, 
    DkimValidationIssue,
    IDkimService 
} from '../types';
import { config } from '../config';
import { logger } from '../utils/logger';

export class DkimService implements IDkimService {
    private readonly dnsService: DnsService;
    private readonly selectorCache: Map<string, { selectors: string[], timestamp: number }> = new Map();
    private readonly cacheTTL = 300000; // 5 minutes in milliseconds

    constructor(dnsService: DnsService) {
        this.dnsService = dnsService;
    }

    private getDkimDomain(selector: string, domain: string): string {
        return `${selector}._domainkey.${domain}`;
    }

    async getDkimRecords(domain: string): Promise<DkimRecordSet> {
        logger.debug(`Getting DKIM records for domain: ${domain}`);
        const selectors = await this.discoverSelectors(domain);
        const records: DkimRecord[] = [];

        await Promise.all(
            selectors.map(async (selector) => {
                try {
                    logger.debug(`Fetching DKIM record for selector: ${selector}, domain: ${domain}`);
                    const record = await this.getDkimRecord(domain, selector);
                    records.push(record);
                    logger.debug(`Fetched DKIM record for selector: ${selector}, domain: ${domain}`);
                } catch (error) {
                    // Skip failed records but continue processing others
                    logger.error(`Failed to fetch DKIM record for selector ${selector}: ${(error instanceof Error ? error.message : String(error))}`);
                }
            })
        );

        logger.debug(`Returning DKIM records for domain: ${domain}, count: ${records.length}`);
        return {
            domain,
            records,
            retrievedAt: new Date()
        };
    }

    async getDkimRecord(domain: string, selector: string): Promise<DkimRecord> {
        logger.debug(`Getting DKIM record for domain: ${domain}, selector: ${selector}`);
        const dkimDomain = this.getDkimDomain(selector, domain);
        logger.debug(`Querying TXT records for DKIM domain: ${dkimDomain}`);
        const txtRecords = await this.dnsService.queryTxt(dkimDomain);

        if (!txtRecords || txtRecords.length === 0) {
            logger.debug(`No DKIM TXT records found for ${dkimDomain}`);
            throw new Error(`No DKIM record found for ${dkimDomain}`);
        }

        // DKIM should be a single TXT record
        const rawRecord = txtRecords[0];
        logger.debug(`Found DKIM TXT record for ${dkimDomain}: ${rawRecord}`);

        const parsedData = this.parseDkimRecord(rawRecord);
        logger.debug(`Parsed DKIM record for ${dkimDomain}:`, parsedData);

        return {
            domain,
            selector,
            rawRecord,
            parsedData,
            retrievedAt: new Date()
        };
    }

    async validateDkimRecords(domain: string): Promise<DkimValidationResult> {
        logger.debug(`Validating DKIM records for domain: ${domain}`);
        const recordSet = await this.getDkimRecords(domain);
        const domainIssues: DkimValidationIssue[] = [];
        const validatedRecords = await Promise.all(
            recordSet.records.map(async (record) => {
                logger.debug(`Validating DKIM record for selector: ${record.selector}`);
                const checks = {
                    hasValidSelector: true,
                    hasValidVersion: record.parsedData.version === 'DKIM1',
                    hasValidAlgorithm: ['rsa-sha256', 'rsa-sha1'].includes(record.parsedData.algorithm),
                    hasValidPublicKey: Boolean(record.parsedData.publicKey),
                    hasValidSyntax: true // Detailed syntax check in parseDkimRecord
                };

                const issues: DkimValidationIssue[] = [];

                if (!checks.hasValidVersion) {
                    issues.push({
                        code: 'INVALID_VERSION',
                        message: `Invalid DKIM version: ${record.parsedData.version}`,
                        severity: 'error'
                    });
                }

                if (!checks.hasValidAlgorithm) {
                    issues.push({
                        code: 'INVALID_ALGORITHM',
                        message: `Invalid algorithm: ${record.parsedData.algorithm}`,
                        severity: 'error'
                    });
                }

                if (!checks.hasValidPublicKey) {
                    issues.push({
                        code: 'MISSING_PUBLIC_KEY',
                        message: 'Missing or invalid public key',
                        severity: 'error'
                    });
                }

                logger.debug(`Validation result for selector ${record.selector}:`, { checks, issues });
                return {
                    selector: record.selector,
                    isValid: Object.values(checks).every(Boolean),
                    checks,
                    issues
                };
            })
        );

        if (validatedRecords.length === 0) {
            domainIssues.push({
                code: 'NO_DKIM_RECORDS',
                message: 'No DKIM records found for domain',
                severity: 'error'
            });
        }

        logger.debug(`Validation summary for domain ${domain}:`, { validatedRecords, domainIssues });
        return {
            domain,
            isValid: validatedRecords.some(r => r.isValid) && domainIssues.length === 0,
            records: validatedRecords,
            domainIssues
        };
    }

    async discoverSelectors(domain: string): Promise<string[]> {
        logger.debug(`Discovering DKIM selectors for domain: ${domain}`);
        // Check cache first
        const cacheKey = `selectors:${domain}`;
        const cached = this.selectorCache.get(cacheKey);
        const now = Date.now();
        
        if (cached && (now - cached.timestamp) < this.cacheTTL) {
            logger.debug(`Using cached selectors for domain: ${domain}`);
            return cached.selectors;
        }

        const discoveredSelectors: string[] = [];
        await Promise.all(
            config.dkim.commonSelectors.map(async (selector) => {
                const dkimDomain = this.getDkimDomain(selector, domain);
                logger.debug(`Checking DKIM selector: ${selector} for domain: ${domain} (FQDN: ${dkimDomain})`);
                try {
                    const records = await this.dnsService.queryTxt(dkimDomain);
                    logger.debug(`DNS TXT query for ${dkimDomain} returned:`, records);
                    if (records && records.length > 0) {
                        discoveredSelectors.push(selector);
                        logger.debug(`Selector ${selector} is valid for domain: ${domain}`);
                    }
                } catch (error) {
                    logger.error(
                        `Error discovering DKIM selector: ${dkimDomain}`,
                        error as Error,
                        { selector, domain }
                    );
                }
            })
        );

        // Cache the results
        this.selectorCache.set(cacheKey, {
            selectors: discoveredSelectors,
            timestamp: now
        });
        logger.debug(`Discovered selectors for domain ${domain}:`, discoveredSelectors);

        return discoveredSelectors;
    }

    parseDkimRecord(record: string): DkimRecord['parsedData'] {
        logger.debug(`Parsing DKIM record: ${record}`);
        // Split on semicolons, ignoring those inside quotes (rare, but RFC-compliant)
        const tagPairs = record.match(/(?:[^;"']|"[^"]*"|'[^']*')+/g) || [];
        const parsedData: DkimRecord['parsedData'] = {
            version: '',
            algorithm: '',
            keyType: '',
            publicKey: '',
            serviceType: undefined,
            flags: undefined,
            notes: undefined
        };

        // Check if 'v' is present and, if so, that it's first
        let firstTagKey: string | undefined;
        for (const pair of tagPairs) {
            const [rawKey] = pair.split('=');
            if (rawKey && rawKey.trim()) {
                firstTagKey = rawKey.trim();
                break;
            }
        }
        const hasVTag = tagPairs.some(pair => pair.trim().startsWith('v='));
        if (hasVTag && firstTagKey !== 'v') {
            logger.error(`If present, the 'v' tag must be the first tag in the DKIM record (RFC 6376 3.6.1). Record: ${record}`);
            throw new Error("If present, the 'v' tag must be the first tag in the DKIM record (RFC 6376 3.6.1).");
        }

        // Use a map to handle repeated tags (last one wins)
        const tagMap: Record<string, string> = {};

        for (const pair of tagPairs) {
            const [rawKey, ...rawValueParts] = pair.split('=');
            if (!rawKey || rawValueParts.length === 0) continue; // skip invalid
            const key = rawKey.trim();
            const value = rawValueParts.join('=').trim(); // in case value contains '='
            tagMap[key] = value;
        }

        // Assign known tags
        if ('v' in tagMap) parsedData.version = tagMap['v'];
        if ('a' in tagMap) parsedData.algorithm = tagMap['a'];
        if ('k' in tagMap) parsedData.keyType = tagMap['k'];
        if ('p' in tagMap) parsedData.publicKey = tagMap['p']; // can be empty string
        if ('s' in tagMap) parsedData.serviceType = tagMap['s'];
        if ('t' in tagMap) parsedData.flags = tagMap['t'].split(':').map(f => f.trim()).filter(Boolean);
        if ('n' in tagMap) parsedData.notes = tagMap['n'];

        logger.debug(`Parsed DKIM record data:`, parsedData);
        return parsedData;
    }
} 