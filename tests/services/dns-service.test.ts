import { checkDnsRegistration, queryDnsRecord } from '../../src/services/dns-service';
import { getConfig } from '../../src/config';
import * as dohBalancer from '../../src/services/doh-balancer';

// Mock fetch globally
global.fetch = jest.fn();

// Mock the DoH balancer to return predictable URLs
jest.mock('../../src/services/doh-balancer');
const mockDohBalancer = dohBalancer as jest.Mocked<typeof dohBalancer>;

// Mock the logger to reduce console output
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('DNS Service', () => {
  const testConfig = getConfig();

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock getRandomDohUrl to always return the first URL for predictable testing
    mockDohBalancer.getRandomDohUrl.mockReturnValue(testConfig.dns.dohUrls[0]);
  });

  describe('checkDnsRegistration', () => {
    it('should return registered domain information', async () => {
      const mockResponse = {
        Status: 0,
        Answer: [
          {
            name: 'example.com',
            type: 1,
            TTL: 300,
            data: '93.184.216.34'
          }
        ]
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await checkDnsRegistration('example.com', testConfig);

      expect(result).toEqual({
        domain: 'example.com',
        isRegistered: true,
        dnsResponse: mockResponse,
        queryTime: expect.any(Number)
      });

      expect(fetch).toHaveBeenCalledWith(
        `${testConfig.dns.dohUrls[0]}?name=example.com&type=A`,
        expect.objectContaining({
          headers: { 
            Accept: 'application/dns-json',
            'User-Agent': 'Mozilla/5.0 (compatible; GeminiDNSChecker/1.0)'
          }
        })
      );
    });

    it('should return unregistered domain information', async () => {
      const mockResponse = {
        Status: 3, // NXDOMAIN
        Answer: []
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await checkDnsRegistration('nonexistent-domain-12345.com', testConfig);

      expect(result).toEqual({
        domain: 'nonexistent-domain-12345.com',
        isRegistered: false,
        dnsResponse: mockResponse,
        queryTime: expect.any(Number)
      });
    });

    it('should retry on failure and eventually succeed', async () => {
      const mockResponse = {
        Status: 0,
        Answer: []
      };

      (fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        });

      const result = await checkDnsRegistration('example.com', testConfig);

      expect(result.isRegistered).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should throw error after all retries fail', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(checkDnsRegistration('example.com', testConfig)).rejects.toThrow(
        'DNS query failed after 3 attempts: Network error'
      );

      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('should handle HTTP error responses', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      await expect(checkDnsRegistration('example.com', testConfig)).rejects.toThrow(
        'DNS query failed after 3 attempts: HTTP 500: Internal Server Error'
      );
    });

    it('should handle timeout', async () => {
      (fetch as jest.Mock).mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('timeout')), 100)
        )
      );

      await expect(checkDnsRegistration('example.com', testConfig)).rejects.toThrow(
        'DNS query failed after 3 attempts: timeout'
      );
    });
  });

  describe('queryDnsRecord', () => {
    it('should query specific record types', async () => {
      const mockResponse = {
        Status: 0,
        Answer: []
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      await queryDnsRecord('example.com', 'TXT', testConfig);

      expect(fetch).toHaveBeenCalledWith(
        `${testConfig.dns.dohUrls[0]}?name=example.com&type=TXT`,
        expect.objectContaining({
          headers: { 
            Accept: 'application/dns-json',
            'User-Agent': 'Mozilla/5.0 (compatible; GeminiDNSChecker/1.0)'
          }
        })
      );
    });
  });
}); 