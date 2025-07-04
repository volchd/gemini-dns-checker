import { DnsResponse } from '../../src/types';

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