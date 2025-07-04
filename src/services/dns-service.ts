import { DnsResponse } from "../types";
import { AppConfig } from "../config";
import { logger } from "../utils/logger";

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
  
  const url = `${config.dns.dohUrl}?name=${encodeURIComponent(domain)}&type=${recordType}`;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.debug(`DNS query attempt ${attempt}/${retries} for ${domain}`, { domain, recordType, attempt });
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, {
        headers: {
          Accept: "application/dns-json",
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const dnsResponse: DnsResponse = await response.json();
      logger.debug(`DNS query successful for ${domain}`, { domain, status: dnsResponse.Status });
      
      return dnsResponse;
      
    } catch (error) {
      const isLastAttempt = attempt === retries;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.warn(`DNS query attempt ${attempt} failed for ${domain}`, { 
        domain, 
        error: errorMessage, 
        attempt,
        isLastAttempt 
      });
      
      if (isLastAttempt) {
        // Preserve the original error message for the final attempt
        throw new Error(`DNS query failed after ${retries} attempts: ${errorMessage}`);
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('DNS query failed - unexpected error');
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
  
  logger.info(`Starting DNS registration check for domain: ${domain}`, { domain });
  
  try {
    const dnsResponse = await performDnsQuery(domain, {}, config);
    const queryTime = Date.now() - startTime;
    
    // Determine if the domain is registered based on the DNS response status.
    // A status of 3 (NXDOMAIN) indicates the domain does not exist.
    const isRegistered = dnsResponse.Status !== 3;
    
    logger.info(`DNS check completed for ${domain}`, { 
      domain, 
      isRegistered, 
      status: dnsResponse.Status,
      queryTime 
    });
    
    return {
      domain,
      isRegistered,
      dnsResponse,
      queryTime,
    };
    
  } catch (error) {
    const queryTime = Date.now() - startTime;
    logger.error(`DNS check failed for ${domain}`, error as Error, { domain, queryTime });
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
  return performDnsQuery(domain, { recordType }, config);
}



