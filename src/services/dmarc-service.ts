import { DmarcRecord, DmarcValidationResult, IDmarcService, DmarcValidationIssue } from "../types";
import { DnsService } from "./dns-service";
import { logger } from "../utils/logger";

export class DmarcServiceImpl implements IDmarcService {
    constructor(private dnsService: DnsService) {}

    async getDmarcRecord(domain: string): Promise<DmarcRecord | null> {
        try {
            logger.debug(`Fetching DMARC record for domain: ${domain}`);
            const dmarcDomain = `_dmarc.${domain}`;
            const txtRecords = await this.dnsService.queryTxt(dmarcDomain);

            // Find the DMARC record (should start with v=DMARC1)
            const dmarcRecord = txtRecords.find(record => record.trim().toLowerCase().startsWith('v=dmarc1'));

            if (!dmarcRecord) {
                logger.debug(`No DMARC record found for domain: ${domain}`);
                return null;
            }

            logger.debug(`Found DMARC record for domain: ${domain}`, { record: dmarcRecord });

            return {
                domain,
                rawRecord: dmarcRecord,
                parsedData: this.parseDmarcRecord(dmarcRecord),
                retrievedAt: new Date()
            };
        } catch (error) {
            logger.error(`Failed to fetch DMARC record for domain: ${domain}`, error as Error);
            throw new Error(`Failed to fetch DMARC record: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async validateDmarcRecord(domain: string): Promise<DmarcValidationResult> {
        const issues: DmarcValidationIssue[] = [];
        const record = await this.getDmarcRecord(domain);

        if (!record) {
            return {
                domain,
                isValid: false,
                record: null,
                checks: {
                    hasValidVersion: false,
                    hasValidPolicy: false,
                    hasValidSyntax: false,
                    hasValidReportAddresses: false
                },
                issues: [{
                    code: 'NO_DMARC_RECORD',
                    message: 'No DMARC record found',
                    severity: 'error'
                }]
            };
        }

        const checks = {
            hasValidVersion: true,
            hasValidPolicy: true,
            hasValidSyntax: true,
            hasValidReportAddresses: true
        };

        // Check version
        if (record.parsedData.version !== 'DMARC1') {
            checks.hasValidVersion = false;
            issues.push({
                code: 'INVALID_VERSION',
                message: 'Invalid DMARC version',
                severity: 'error'
            });
        }

        // Check policy
        if (!['none', 'quarantine', 'reject'].includes(record.parsedData.policy)) {
            checks.hasValidPolicy = false;
            issues.push({
                code: 'INVALID_POLICY',
                message: 'Invalid DMARC policy',
                severity: 'error'
            });
        }

        // Check report addresses if present
        if (record.parsedData.reportEmails?.length || record.parsedData.forensicEmails?.length) {
            const validEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const allEmails = [
                ...(record.parsedData.reportEmails || []),
                ...(record.parsedData.forensicEmails || [])
            ];

            const hasInvalidEmail = allEmails.some(email => !validEmailRegex.test(email));
            if (hasInvalidEmail) {
                checks.hasValidReportAddresses = false;
                issues.push({
                    code: 'INVALID_REPORT_EMAIL',
                    message: 'One or more report email addresses are invalid',
                    severity: 'error'
                });
            }
        }

        // Add warnings for recommended practices
        if (record.parsedData.policy === 'none') {
            issues.push({
                code: 'POLICY_NONE',
                message: 'Policy is set to "none" which only monitors and does not take action',
                severity: 'warning'
            });
        }

        if (!record.parsedData.reportEmails?.length) {
            issues.push({
                code: 'NO_AGGREGATE_REPORTS',
                message: 'No aggregate report email addresses specified (rua)',
                severity: 'warning'
            });
        }

        return {
            domain,
            isValid: !issues.some(issue => issue.severity === 'error'),
            record,
            checks,
            issues
        };
    }

    parseDmarcRecord(record: string): DmarcRecord['parsedData'] {
        const tags = record.split(';').map(tag => tag.trim());
        const parsedData: DmarcRecord['parsedData'] = {
            version: '',
            policy: 'none'
        };

        for (const tag of tags) {
            const [key, value] = tag.split('=').map(part => part.trim());
            
            switch (key.toLowerCase()) {
                case 'v':
                    parsedData.version = value.toUpperCase();
                    break;
                case 'p':
                    parsedData.policy = value.toLowerCase();
                    break;
                case 'sp':
                    parsedData.subdomainPolicy = value.toLowerCase();
                    break;
                case 'pct':
                    parsedData.percentage = parseInt(value, 10);
                    break;
                case 'rf':
                    parsedData.reportFormat = value.split(':');
                    break;
                case 'ri':
                    parsedData.reportInterval = parseInt(value, 10);
                    break;
                case 'rua':
                    parsedData.reportEmails = value.split(',').map(uri => {
                        // Extract email from mailto: URI
                        const match = uri.match(/mailto:(.+)/);
                        return match ? match[1].trim() : uri.trim();
                    });
                    break;
                case 'ruf':
                    parsedData.forensicEmails = value.split(',').map(uri => {
                        const match = uri.match(/mailto:(.+)/);
                        return match ? match[1].trim() : uri.trim();
                    });
                    break;
                case 'fo':
                    parsedData.failureOptions = value.split(':');
                    break;
                case 'aspf':
                    parsedData.alignmentSpf = value.toLowerCase();
                    break;
                case 'adkim':
                    parsedData.alignmentDkim = value.toLowerCase();
                    break;
            }
        }

        return parsedData;
    }
} 