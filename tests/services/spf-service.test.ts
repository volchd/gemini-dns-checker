import { getSpfRecord } from '../../src/services/spf-service';
import { AppConfig } from '../../src/config';
import { DnsMock } from '../mocks/dns-mock';
import { MOCK_DNS_RESPONSES, TEST_CONFIG } from '../fixtures/test-data';

// Mock fetch globally
global.fetch = jest.fn();

describe('SPF Service', () => {
  const testConfig: AppConfig = TEST_CONFIG;

  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.log for cleaner test output
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getSpfRecord', () => {
    it('should fetch basic SPF record', async () => {
      const mockResponse = {
        Status: 0,
        Answer: [{
          name: 'example.com',
          type: 16,
          TTL: 300,
          data: '"v=spf1 ip4:192.168.1.0/24 ~all"'
        }]
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await getSpfRecord('example.com', new Set(), 'initial', testConfig);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        domain: 'example.com',
        spfRecord: '"v=spf1 ip4:192.168.1.0/24 ~all"',
        type: 'initial'
      });

      expect(fetch).toHaveBeenCalledWith(
        `${testConfig.dns.dohUrl}?name=example.com&type=TXT`,
        expect.objectContaining({
          headers: { Accept: 'application/dns-json' }
        })
      );
    });

    it('should handle multiple SPF records', async () => {
      const mockResponse = {
        Status: 0,
        Answer: [
          {
            name: 'example.com',
            type: 16,
            TTL: 300,
            data: '"v=spf1 ip4:192.168.1.0/24 ~all"'
          },
          {
            name: 'example.com',
            type: 16,
            TTL: 300,
            data: '"v=spf1 include:backup.example.com ~all"'
          }
        ]
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await getSpfRecord('example.com', new Set(), 'initial', testConfig);

      expect(result).toHaveLength(2);
      expect(result[0].spfRecord).toBe('"v=spf1 ip4:192.168.1.0/24 ~all"');
      expect(result[1].spfRecord).toBe('"v=spf1 include:backup.example.com ~all"');
    });

    it('should process include mechanisms recursively', async () => {
      // First call for main domain
      const mainResponse = {
        Status: 0,
        Answer: [{
          name: 'example.com',
          type: 16,
          TTL: 300,
          data: '"v=spf1 include:_spf.google.com ~all"'
        }]
      };

      // Second call for included domain
      const includeResponse = {
        Status: 0,
        Answer: [{
          name: '_spf.google.com',
          type: 16,
          TTL: 300,
          data: '"v=spf1 ip4:209.85.128.0/17 ~all"'
        }]
      };

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mainResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(includeResponse)
        });

      const result = await getSpfRecord('example.com', new Set(), 'initial', testConfig);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        domain: 'example.com',
        spfRecord: '"v=spf1 include:_spf.google.com ~all"',
        type: 'initial'
      });
      expect(result[1]).toEqual({
        domain: '_spf.google.com',
        spfRecord: '"v=spf1 ip4:209.85.128.0/17 ~all"',
        type: 'include'
      });

      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should process redirect mechanisms', async () => {
      // First call for main domain
      const mainResponse = {
        Status: 0,
        Answer: [{
          name: 'example.com',
          type: 16,
          TTL: 300,
          data: '"v=spf1 redirect=spf.example.com"'
        }]
      };

      // Second call for redirected domain
      const redirectResponse = {
        Status: 0,
        Answer: [{
          name: 'spf.example.com',
          type: 16,
          TTL: 300,
          data: '"v=spf1 ip4:192.168.1.0/24 ~all"'
        }]
      };

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mainResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(redirectResponse)
        });

      const result = await getSpfRecord('example.com', new Set(), 'initial', testConfig);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        domain: 'example.com',
        spfRecord: '"v=spf1 redirect=spf.example.com"',
        type: 'initial'
      });
      expect(result[1]).toEqual({
        domain: 'spf.example.com',
        spfRecord: '"v=spf1 ip4:192.168.1.0/24 ~all"',
        type: 'redirect'
      });
    });

    it('should detect and prevent circular dependencies', async () => {
      const visitedDomains = new Set(['example.com']);
      
      const result = await getSpfRecord('example.com', visitedDomains, 'initial', testConfig);

      expect(result).toHaveLength(0);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should handle non-existent included domains', async () => {
      // First call for main domain
      const mainResponse = {
        Status: 0,
        Answer: [{
          name: 'example.com',
          type: 16,
          TTL: 300,
          data: '"v=spf1 include:nonexistent.example.com ~all"'
        }]
      };

      // Second call returns NXDOMAIN
      const nxResponse = {
        Status: 3,
        Answer: []
      };

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mainResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(nxResponse)
        });

      const result = await getSpfRecord('example.com', new Set(), 'initial', testConfig);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        domain: 'example.com',
        spfRecord: '"v=spf1 include:nonexistent.example.com ~all"',
        type: 'initial'
      });
    });

    it('should handle malformed include mechanisms', async () => {
      const mockResponse = {
        Status: 0,
        Answer: [{
          name: 'example.com',
          type: 16,
          TTL: 300,
          data: '"v=spf1 include: ~all"' // malformed - no domain after include
        }]
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await getSpfRecord('example.com', new Set(), 'initial', testConfig);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        domain: 'example.com',
        spfRecord: '"v=spf1 include: ~all"',
        type: 'initial'
      });

      // Should only make one call (main domain) since include is malformed
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should respect visited domains set', async () => {
      const visitedDomains = new Set(['_spf.google.com']);
      
      const mainResponse = {
        Status: 0,
        Answer: [{
          name: 'example.com',
          type: 16,
          TTL: 300,
          data: '"v=spf1 include:_spf.google.com ~all"'
        }]
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mainResponse)
      });

      const result = await getSpfRecord('example.com', visitedDomains, 'initial', testConfig);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        domain: 'example.com',
        spfRecord: '"v=spf1 include:_spf.google.com ~all"',
        type: 'initial'
      });

      // Should only make one call since _spf.google.com is already visited
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle DNS query failures gracefully', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('DNS query failed'));

      await expect(getSpfRecord('example.com', new Set(), 'initial', testConfig))
        .rejects.toThrow('DNS TXT query failed');
    });

    it('should handle HTTP error responses', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      await expect(getSpfRecord('example.com', new Set(), 'initial', testConfig))
        .rejects.toThrow('DNS TXT query failed');
    });

    it('should parse quoted TXT records correctly', async () => {
      const mockResponse = {
        Status: 0,
        Answer: [{
          name: 'example.com',
          type: 16,
          TTL: 300,
          data: '"v=spf1 ip4:192.168.1.0/24 ~all"'
        }]
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await getSpfRecord('example.com', new Set(), 'initial', testConfig);

      expect(result[0].spfRecord).toBe('"v=spf1 ip4:192.168.1.0/24 ~all"');
    });

    it('should handle domains with no TXT records', async () => {
      const mockResponse = {
        Status: 0,
        Answer: []
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await getSpfRecord('example.com', new Set(), 'initial', testConfig);

      expect(result).toHaveLength(0);
    });

    it('should handle domains with non-SPF TXT records', async () => {
      const mockResponse = {
        Status: 0,
        Answer: [
          {
            name: 'example.com',
            type: 16,
            TTL: 300,
            data: '"google-site-verification=12345"'
          },
          {
            name: 'example.com',
            type: 16,
            TTL: 300,
            data: '"v=DMARC1; p=reject;"'
          }
        ]
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await getSpfRecord('example.com', new Set(), 'initial', testConfig);

      expect(result).toHaveLength(0);
    });

    it('should handle extremely long SPF chains', async () => {
      // Create a chain of 15 includes (should handle gracefully)
      const responses: Array<{ ok: boolean; json: () => Promise<any> }> = [];
      
      // Main domain
      responses.push({
        ok: true,
        json: () => Promise.resolve({
          Status: 0,
          Answer: [{
            name: 'example.com',
            type: 16,
            TTL: 300,
            data: '"v=spf1 include:spf1.example.com ~all"'
          }]
        })
      });

      // Chain of 14 includes
      for (let i = 1; i <= 14; i++) {
        const nextDomain = i < 14 ? `spf${i + 1}.example.com` : '';
        responses.push({
          ok: true,
          json: () => Promise.resolve({
            Status: 0,
            Answer: [{
              name: `spf${i}.example.com`,
              type: 16,
              TTL: 300,
              data: nextDomain ? 
                `"v=spf1 include:${nextDomain} ~all"` : 
                '"v=spf1 ip4:192.168.1.0/24 ~all"'
            }]
          })
        });
      }

      (fetch as jest.Mock).mockImplementation(() => Promise.resolve(responses.shift()));

      const result = await getSpfRecord('example.com', new Set(), 'initial', testConfig);

      expect(result.length).toBeGreaterThan(1);
      expect(fetch).toHaveBeenCalledTimes(15);
    });

    it('should handle multiple include mechanisms in one record', async () => {
      const mainResponse = {
        Status: 0,
        Answer: [{
          name: 'example.com',
          type: 16,
          TTL: 300,
          data: '"v=spf1 include:spf1.example.com include:spf2.example.com ~all"'
        }]
      };

      const include1Response = {
        Status: 0,
        Answer: [{
          name: 'spf1.example.com',
          type: 16,
          TTL: 300,
          data: '"v=spf1 ip4:192.168.1.0/24 ~all"'
        }]
      };

      const include2Response = {
        Status: 0,
        Answer: [{
          name: 'spf2.example.com',
          type: 16,
          TTL: 300,
          data: '"v=spf1 ip4:10.0.0.0/8 ~all"'
        }]
      };

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mainResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(include1Response)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(include2Response)
        });

      const result = await getSpfRecord('example.com', new Set(), 'initial', testConfig);

      expect(result).toHaveLength(3);
      expect(result[0].domain).toBe('example.com');
      expect(result[1].domain).toBe('spf1.example.com');
      expect(result[2].domain).toBe('spf2.example.com');
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('should handle both include and redirect in same domain chain', async () => {
      // Domain with include
      const mainResponse = {
        Status: 0,
        Answer: [{
          name: 'example.com',
          type: 16,
          TTL: 300,
          data: '"v=spf1 include:spf.example.com ~all"'
        }]
      };

      // Included domain with redirect
      const includeResponse = {
        Status: 0,
        Answer: [{
          name: 'spf.example.com',
          type: 16,
          TTL: 300,
          data: '"v=spf1 redirect=final.example.com"'
        }]
      };

      // Final redirected domain
      const redirectResponse = {
        Status: 0,
        Answer: [{
          name: 'final.example.com',
          type: 16,
          TTL: 300,
          data: '"v=spf1 ip4:192.168.1.0/24 ~all"'
        }]
      };

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mainResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(includeResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(redirectResponse)
        });

      const result = await getSpfRecord('example.com', new Set(), 'initial', testConfig);

      expect(result).toHaveLength(3);
      expect(result[0].type).toBe('initial');
      expect(result[1].type).toBe('include');
      expect(result[2].type).toBe('redirect');
    });
  });
});