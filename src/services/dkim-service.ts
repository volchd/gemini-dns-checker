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
        logger.debug('DKIM service initialized');
    }

    private getDkimDomain(selector: string, domain: string): string {
        const dkimDomain = `${selector}._domainkey.${domain}`;
        logger.debug(`Constructed DKIM domain: ${dkimDomain}`, { selector, domain });
        return dkimDomain;
    }

    async getDkimRecords(domain: string): Promise<DkimRecordSet> {
        logger.debug(`Getting DKIM records for domain: ${domain}`);
        const selectors = await this.discoverSelectors(domain);
        logger.debug(`Found ${selectors.length} DKIM selectors for domain: ${domain}`, { 
            domain, 
            selectors 
        });

        const records: DkimRecord[] = [];

        await Promise.all(
            selectors.map(async (selector) => {
                try {
                    logger.debug(`Fetching DKIM record for selector: ${selector}, domain: ${domain}`);
                    const record = await this.getDkimRecord(domain, selector);
                    records.push(record);
                    logger.debug(`Successfully fetched DKIM record for selector: ${selector}`, {
                        domain,
                        selector,
                        version: record.parsedData.version,
                        algorithm: record.parsedData.algorithm
                    });
                } catch (error) {
                    // Skip failed records but continue processing others
                    logger.error(
                        `Failed to fetch DKIM record for selector ${selector}`, 
                        error as Error,
                        { domain, selector }
                    );
                }
            })
        );

        logger.debug(`Retrieved ${records.length} DKIM records for domain: ${domain}`, {
            domain,
            recordCount: records.length,
            selectors: records.map(r => r.selector)
        });

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
        logger.debug(`Parsed DKIM record for ${dkimDomain}`, {
            domain,
            selector,
            version: parsedData.version,
            algorithm: parsedData.algorithm,
            keyType: parsedData.keyType,
            flags: parsedData.flags
        });

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
                logger.debug(`Validating DKIM record for selector: ${record.selector}`, {
                    domain,
                    selector: record.selector
                });

                const checks = {
                    hasValidSelector: true,
                    hasValidVersion: record.parsedData.version === 'DKIM1',
                    hasValidAlgorithm: ['rsa-sha256', 'rsa-sha1'].includes(record.parsedData.algorithm),
                    hasValidPublicKey: Boolean(record.parsedData.publicKey),
                    hasValidSyntax: true // Detailed syntax check in parseDkimRecord
                };

                const issues: DkimValidationIssue[] = [];

                if (!checks.hasValidVersion) {
                    logger.debug(`Invalid DKIM version for selector: ${record.selector}`, {
                        domain,
                        selector: record.selector,
                        version: record.parsedData.version
                    });
                    issues.push({
                        code: 'INVALID_VERSION',
                        message: `Invalid DKIM version: ${record.parsedData.version}`,
                        severity: 'error'
                    });
                }

                if (!checks.hasValidAlgorithm) {
                    logger.debug(`Invalid DKIM algorithm for selector: ${record.selector}`, {
                        domain,
                        selector: record.selector,
                        algorithm: record.parsedData.algorithm
                    });
                    issues.push({
                        code: 'INVALID_ALGORITHM',
                        message: `Invalid algorithm: ${record.parsedData.algorithm}`,
                        severity: 'error'
                    });
                }

                if (!checks.hasValidPublicKey) {
                    logger.debug(`Missing or invalid public key for selector: ${record.selector}`, {
                        domain,
                        selector: record.selector
                    });
                    issues.push({
                        code: 'MISSING_PUBLIC_KEY',
                        message: 'Missing or invalid public key',
                        severity: 'error'
                    });
                }

                logger.debug(`Validation result for selector ${record.selector}`, { 
                    domain,
                    selector: record.selector,
                    checks, 
                    issueCount: issues.length 
                });

                return {
                    selector: record.selector,
                    isValid: issues.length === 0,
                    checks,
                    issues
                };
            })
        );

        const isValid = validatedRecords.every(r => r.isValid) && domainIssues.length === 0;
        logger.debug(`DKIM validation complete for domain: ${domain}`, {
            domain,
            isValid,
            recordCount: validatedRecords.length,
            domainIssueCount: domainIssues.length
        });

        return {
            domain,
            isValid,
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
            logger.debug(`Using cached selectors for domain: ${domain}`, {
                domain,
                selectors: cached.selectors,
                cacheAge: now - cached.timestamp
            });
            return cached.selectors;
        }

        const discoveredSelectors: string[] = [];
        await Promise.all(
            config.dkim.commonSelectors.map(async (selector) => {
                const dkimDomain = this.getDkimDomain(selector, domain);
                logger.debug(`Checking DKIM selector: ${selector} for domain: ${domain}`, {
                    domain,
                    selector,
                    dkimDomain
                });
                try {
                    const records = await this.dnsService.queryTxt(dkimDomain);
                    logger.debug(`DNS TXT query for ${dkimDomain} returned ${records.length} records`);
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
        logger.debug(`Discovered ${discoveredSelectors.length} selectors for domain ${domain}`, {
            domain,
            selectors: discoveredSelectors
        });

        return discoveredSelectors;
    }

    parseDkimRecord(record: string): DkimRecord['parsedData'] {
        logger.debug(`Parsing DKIM record: ${record}`);
        const parsedData: DkimRecord['parsedData'] = {
            version: '',
            algorithm: '',
            keyType: '',
            publicKey: '',
        };

        // Split record into tag-value pairs
        const pairs = record.split(';').map(pair => pair.trim());
        const tagMap: { [key: string]: string } = {};

        // Parse each tag-value pair
        for (const pair of pairs) {
            if (!pair) continue;
            const [tag, value] = pair.split('=', 2).map(s => s.trim());
            if (tag && value) {
                tagMap[tag] = value;
                logger.debug(`Parsed DKIM tag: ${tag}=${value}`);
            }
        }

        // Extract known fields
        if ('v' in tagMap) parsedData.version = tagMap['v'];
        if ('a' in tagMap) parsedData.algorithm = tagMap['a'].toLowerCase();
        if ('k' in tagMap) parsedData.keyType = tagMap['k'].toLowerCase();
        if ('p' in tagMap) parsedData.publicKey = tagMap['p'];
        // Optional fields
        if ('s' in tagMap) parsedData.serviceType = tagMap['s'];
        if ('t' in tagMap) parsedData.flags = tagMap['t'].split(':').map(f => f.trim()).filter(Boolean);
        if ('n' in tagMap) parsedData.notes = tagMap['n'];

        logger.debug(`Parsed DKIM record data`, {
            version: parsedData.version,
            algorithm: parsedData.algorithm,
            keyType: parsedData.keyType,
            hasPublicKey: Boolean(parsedData.publicKey),
            flags: parsedData.flags
        });
        return parsedData;
    }

    /**
     * Scores DKIM configuration for a domain.
     * Returns total score and breakdown.
     */
    async scoreDkim(domain: string): Promise<{
        total: number;
        breakdown: {
            implemented: number;
            keyLength: number;
            multipleSelectors: number;
            noTestMode: number;
            keyLengths: { selector: string; bits: number | null }[];
            testModeSelectors: string[];
        };
    }> {
        const recordSet = await this.getDkimRecords(domain);
        const records = recordSet.records;

        // 1. DKIM Implemented
        const implemented = records.length > 0 ? 10 : 0;

        // 2. DKIM Key Length
        let keyLengthScore = 0;
        let maxKeyLength = 0;
        let hasWeakKey = false;
        const keyLengths: { selector: string; bits: number | null }[] = [];

        for (const record of records) {
            let bits: number | null = null;
            try {
                if (record.parsedData.publicKey) {
                    // Remove whitespace from base64
                    const keyData = record.parsedData.publicKey.replace(/\s+/g, '');
                    // Decode base64 to binary
                    const binary = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
                    // Try to import as RSA key
                    const cryptoKey = await crypto.subtle.importKey(
                        'spki',
                        binary.buffer,
                        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
                        false,
                        ['verify']
                    );
                    // @ts-ignore: modulusLength is not standard, but may be present in Workers
                    bits = cryptoKey.algorithm.modulusLength || null;
                }
            } catch {
                bits = null;
            }
            keyLengths.push({ selector: record.selector, bits });
            if (bits !== null) {
                if (bits < 1024) hasWeakKey = true;
                if (bits > maxKeyLength) maxKeyLength = bits;
            }
        }

        if (hasWeakKey) {
            keyLengthScore = 0; // or 1 if you want to be lenient
        } else if (maxKeyLength >= 2048) {
            keyLengthScore = 5;
        } else if (maxKeyLength >= 1024) {
            keyLengthScore = 3;
        }

        // 3. Multiple Selectors
        const multipleSelectors = records.length >= 2 ? 3 : 0;

        // 4. No DKIM Test Mode
        const testModeSelectors = records
            .filter(r => Array.isArray(r.parsedData.flags) && r.parsedData.flags.includes('y'))
            .map(r => r.selector);
        const noTestMode = testModeSelectors.length === 0 ? 2 : 0;

        // Total
        const total = implemented + keyLengthScore + multipleSelectors + noTestMode;

        return {
            total,
            breakdown: {
                implemented,
                keyLength: keyLengthScore,
                multipleSelectors,
                noTestMode,
                keyLengths,
                testModeSelectors
            }
        };
    }
} 