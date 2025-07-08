import { DnsResponse } from "../types";
import { AppConfig, config } from "../config";
import { logger } from "../utils/logger";
import { getRandomDohUrl } from "./doh-balancer";

export interface DnsQueryOptions {
  recordType?: string;
  timeout?: number;
  retries?: number;
}

export interface DnsQueryResult {
  domain: string;
  isRegistered: boolean;
  dnsResponse: DnsResponse;
  queryTime?: number;
}

export interface DnsService {
    queryTxt(domain: string): Promise<string[]>;
}

export class DnsServiceImpl implements DnsService {
    async queryTxt(domain: string): Promise<string[]> {
        try {
            logger.debug(`Starting TXT record query for domain: ${domain}`);
            const response = await queryDnsRecord(domain, 'TXT', config);
            
            if (!response.Answer) {
                logger.debug(`No TXT records found for domain: ${domain}`);
                return [];
            }

            // Extract TXT records from the response
            // DNS responses often include quotes around TXT record data
            // and may split long TXT records into multiple parts
            const txtRecords = response.Answer
                .filter(answer => {
                    const isTxt = answer.type === 16;
                    logger.debug(`Processing DNS answer - Type: ${answer.type}, Is TXT: ${isTxt}`, { 
                        domain, 
                        recordType: answer.type,
                        data: answer.data 
                    });
                    return isTxt;
                })
                .map(answer => {
                    // Handle potential array of strings or single string
                    const data = Array.isArray(answer.data) ? answer.data : [answer.data];
                    // Join parts and remove surrounding quotes if present
                    const processedRecord = data
                        .map(part => part.replace(/^"(.*)"$/, '$1'))
                        .join('');
                    logger.debug(`Processed TXT record: ${processedRecord}`, { domain });
                    return processedRecord;
                });

            logger.debug(`Found ${txtRecords.length} TXT records for domain: ${domain}`, { 
                domain, 
                recordCount: txtRecords.length,
                records: txtRecords 
            });
            return txtRecords;
        } catch (error) {
            logger.error(`Failed to query TXT records for domain: ${domain}`, error as Error, { domain });
            throw new Error(`Failed to query TXT records: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

/**
 * Performs a DNS query with retry logic and timeout handling.
 * @param domain The domain name to query.
 * @param options Query options including record type, timeout, and retries.
 * @param config Configuration object for DNS settings.
 * @returns Promise resolving to DNS query result.
 * @throws Error if all retries fail or timeout is exceeded.
 */
async function performDnsQuery(domain: string, options: DnsQueryOptions = {}, config: AppConfig): Promise<DnsResponse> {
    const { recordType = 'A', timeout = config.dns.timeout, retries = config.dns.retries } = options;
    
    const dohUrl = getRandomDohUrl(config);
    logger.debug(`Selected DoH URL: ${dohUrl} for domain: ${domain}`, { domain, dohUrl });
    
    const url = `${dohUrl}?name=${encodeURIComponent(domain)}&type=${recordType}`;
    logger.debug(`Constructed DNS query URL: ${url}`, { domain, recordType });

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            logger.debug(`DNS query attempt ${attempt}/${retries} for ${domain}`, { 
                domain, 
                recordType, 
                attempt, 
                url,
                timeout 
            });
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
                logger.debug(`DNS query timeout for ${domain} (attempt ${attempt})`, { 
                    domain, 
                    attempt, 
                    timeout 
                });
            }, timeout);
            
            const response = await fetch(url, {
                headers: {
                    Accept: "application/dns-json",
                    "User-Agent": "Mozilla/5.0 (compatible; GeminiDNSChecker/1.0)",
                },
                signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                logger.debug(`DNS query HTTP error for ${domain} (attempt ${attempt})`, { 
                    domain, 
                    attempt, 
                    status: response.status,
                    statusText: response.statusText 
                });
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const dnsResponse: DnsResponse = await response.json();
            logger.debug(`DNS query successful for ${domain}`, { 
                domain, 
                status: dnsResponse.Status,
                answerCount: dnsResponse.Answer?.length || 0
            });
            
            return dnsResponse;
            
        } catch (error) {
            const isLastAttempt = attempt === retries;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            
            logger.debug(`DNS query attempt ${attempt} failed for ${domain}`, { 
                domain, 
                attempt, 
                error: errorMessage,
                isLastAttempt 
            });

            if (isLastAttempt) {
                logger.error(`All DNS query attempts failed for ${domain}`, error as Error, {
                    domain,
                    recordType,
                    attempts: retries
                });
                throw error;
            }
            
            // Add exponential backoff delay between retries
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
            logger.debug(`Waiting ${delay}ms before retry for ${domain}`, { domain, attempt, delay });
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    // This should never be reached due to the throw in the last retry
    throw new Error(`DNS query failed after ${retries} attempts`);
}

/**
 * Checks the DNS registration status of a given domain using a DNS over HTTPS (DoH) service.
 * @param domain The domain name to check.
 * @param config Configuration object for DNS settings.
 * @returns An object containing the domain, its registration status, and the full DoH response.
 * @throws Error if the DNS query fails or returns an unexpected status.
 */
export async function checkDnsRegistration(domain: string, config: AppConfig): Promise<DnsQueryResult> {
    const startTime = Date.now();
    
    logger.debug(`Starting DNS registration check for domain: ${domain}`, { domain });
    
    try {
        const dnsResponse = await performDnsQuery(domain, {}, config);
        const queryTime = Date.now() - startTime;
        
        // Determine if the domain is registered based on the DNS response status.
        // A status of 3 (NXDOMAIN) indicates the domain does not exist.
        const isRegistered = dnsResponse.Status !== 3;
        
        logger.debug(`DNS registration check completed for ${domain}`, { 
            domain, 
            isRegistered, 
            status: dnsResponse.Status,
            queryTime,
            hasAnswers: Boolean(dnsResponse.Answer?.length)
        });
        
        return {
            domain,
            isRegistered,
            dnsResponse,
            queryTime,
        };
        
    } catch (error) {
        const queryTime = Date.now() - startTime;
        logger.error(`DNS registration check failed for ${domain}`, error as Error, { 
            domain, 
            queryTime 
        });
        throw error;
    }
}

/**
 * Performs a DNS query for a specific record type.
 * @param domain The domain name to query.
 * @param recordType The DNS record type (e.g., 'A', 'AAAA', 'TXT', 'MX').
 * @param config Configuration object for DNS settings.
 * @returns Promise resolving to DNS response.
 */
export async function queryDnsRecord(domain: string, recordType: string, config: AppConfig): Promise<DnsResponse> {
    logger.debug(`Querying DNS record type ${recordType} for domain: ${domain}`, { 
        domain, 
        recordType 
    });
    return performDnsQuery(domain, { recordType }, config);
}



