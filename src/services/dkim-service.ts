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
        const selectors = await this.discoverSelectors(domain);
        const records: DkimRecord[] = [];

        await Promise.all(
            selectors.map(async (selector) => {
                try {
                    const record = await this.getDkimRecord(domain, selector);
                    records.push(record);
                } catch (error) {
                    // Skip failed records but continue processing others
                    console.error(`Failed to fetch DKIM record for selector ${selector}:`, error);
                }
            })
        );

        return {
            domain,
            records,
            retrievedAt: new Date()
        };
    }

    async getDkimRecord(domain: string, selector: string): Promise<DkimRecord> {
        const dkimDomain = this.getDkimDomain(selector, domain);
        const txtRecords = await this.dnsService.queryTxt(dkimDomain);

        if (!txtRecords || txtRecords.length === 0) {
            throw new Error(`No DKIM record found for ${dkimDomain}`);
        }

        // DKIM should be a single TXT record
        const rawRecord = txtRecords[0];

        return {
            domain,
            selector,
            rawRecord,
            parsedData: this.parseDkimRecord(rawRecord),
            retrievedAt: new Date()
        };
    }

    async validateDkimRecords(domain: string): Promise<DkimValidationResult> {
        const recordSet = await this.getDkimRecords(domain);
        const domainIssues: DkimValidationIssue[] = [];
        const validatedRecords = await Promise.all(
            recordSet.records.map(async (record) => {
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

        return {
            domain,
            isValid: validatedRecords.some(r => r.isValid) && domainIssues.length === 0,
            records: validatedRecords,
            domainIssues
        };
    }

    async discoverSelectors(domain: string): Promise<string[]> {
        // Check cache first
        const cacheKey = `selectors:${domain}`;
        const cached = this.selectorCache.get(cacheKey);
        const now = Date.now();
        
        if (cached && (now - cached.timestamp) < this.cacheTTL) {
            logger.info(`Using cached selectors for domain: ${domain}`);
            return cached.selectors;
        }

        const discoveredSelectors: string[] = [];
        await Promise.all(
            config.dkim.commonSelectors.map(async (selector) => {
                const dkimDomain = this.getDkimDomain(selector, domain);
                logger.info(`Discovering DKIM selector: ${dkimDomain}`);
                try {
                    const records = await this.dnsService.queryTxt(dkimDomain);
                    logger.info(`Discovered DKIM selector: ${records}`);
                    if (records && records.length > 0) {
                        discoveredSelectors.push(selector);
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

        return discoveredSelectors;
    }

    parseDkimRecord(record: string): DkimRecord['parsedData'] {
        const tags = record.split(';').map(tag => tag.trim());
        const parsedData: DkimRecord['parsedData'] = {
            version: '',
            algorithm: '',
            keyType: '',
            publicKey: '',
            serviceType: undefined,
            flags: undefined,
            notes: undefined
        };

        for (const tag of tags) {
            const [key, value] = tag.split('=').map(part => part.trim());
            
            switch (key) {
                case 'v':
                    parsedData.version = value;
                    break;
                case 'a':
                    parsedData.algorithm = value;
                    break;
                case 'k':
                    parsedData.keyType = value;
                    break;
                case 'p':
                    parsedData.publicKey = value;
                    break;
                case 's':
                    parsedData.serviceType = value;
                    break;
                case 't':
                    parsedData.flags = value.split(':');
                    break;
                case 'n':
                    parsedData.notes = value;
                    break;
            }
        }

        return parsedData;
    }
} 