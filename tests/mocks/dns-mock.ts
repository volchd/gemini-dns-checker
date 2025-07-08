import { DnsResponse } from '../../src/types';
import { DnsService } from '../../src/services/dns-service';
import { DKIM_TEST_DATA } from '../fixtures/test-data';

export class DnsMock {
  static mockSuccessfulResponse(domain: string, recordType: string = 'A'): jest.Mock {
    const mockResponse: DnsResponse = {
      Status: 0,
      Answer: [{
        name: domain,
        type: recordType === 'A' ? 1 : recordType === 'TXT' ? 16 : 1,
        TTL: 300,
        data: recordType === 'A' ? '93.184.216.34' : `"v=spf1 ip4:192.168.1.0/24 ~all"`
      }]
    };

    return jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });
  }

  static mockNxDomain(domain: string): jest.Mock {
    const mockResponse: DnsResponse = {
      Status: 3, // NXDOMAIN
      Answer: []
    };

    return jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });
  }

  static mockTimeout(): jest.Mock {
    return jest.fn().mockImplementation(() => 
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), 100)
      )
    );
  }

  static mockServerError(): jest.Mock {
    return jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    });
  }

  static mockNetworkError(): jest.Mock {
    return jest.fn().mockRejectedValue(new Error('Network error'));
  }

  static mockServerFail(): jest.Mock {
    const mockResponse: DnsResponse = {
      Status: 2, // SERVFAIL
      Answer: []
    };

    return jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });
  }

  static mockRefused(): jest.Mock {
    const mockResponse: DnsResponse = {
      Status: 5, // REFUSED
      Answer: []
    };

    return jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });
  }

  static mockMalformedResponse(): jest.Mock {
    return jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ invalid: 'response' })
    });
  }

  static mockMultipleAttempts(attempts: number, finalResponse?: any): jest.Mock {
    const mock = jest.fn();
    
    // Fail for all attempts except the last one
    for (let i = 0; i < attempts - 1; i++) {
      mock.mockRejectedValueOnce(new Error('Network error'));
    }
    
    // Succeed on the final attempt
    if (finalResponse) {
      mock.mockResolvedValueOnce(finalResponse);
    } else {
      mock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ Status: 0, Answer: [] })
      });
    }
    
    return mock;
  }
}

export class MockDnsService implements DnsService {
    private mockResponses: Map<string, string[]>;
    private queryCallCount: Map<string, number> = new Map();

    constructor() {
        this.mockResponses = new Map();
        this.setupDefaultMocks();
    }

    private setupDefaultMocks() {
        // Set up DKIM record mocks
        const { validRecords, invalidRecords, testDomains } = DKIM_TEST_DATA;

        // Mock valid domain with single record
        this.mockResponses.set(
            `google._domainkey.${testDomains.valid}`,
            [validRecords.google]
        );

        // Mock domain with multiple records
        this.mockResponses.set(
            `selector1._domainkey.${testDomains.withMultipleRecords}`,
            [validRecords.selector1]
        );
        this.mockResponses.set(
            `selector2._domainkey.${testDomains.withMultipleRecords}`,
            [validRecords.selector2]
        );

        // Mock domain with invalid records
        this.mockResponses.set(
            `default._domainkey.${testDomains.withInvalidRecords}`,
            [invalidRecords.invalidVersion]
        );
    }

    async queryTxt(domain: string): Promise<string[]> {
        // Track query calls for testing
        const currentCount = this.queryCallCount.get(domain) || 0;
        this.queryCallCount.set(domain, currentCount + 1);
        
        const records = this.mockResponses.get(domain);
        return records || [];
    }

    setMockResponse(domain: string, records: string[]) {
        this.mockResponses.set(domain, records);
    }

    clearMocks() {
        this.mockResponses.clear();
        this.queryCallCount.clear();
        this.setupDefaultMocks();
    }

    getQueryCallCount(domain: string): number {
        return this.queryCallCount.get(domain) || 0;
    }

    resetQueryCallCount() {
        this.queryCallCount.clear();
    }
}