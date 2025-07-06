import { getRandomDohUrl, getAllDohUrls, validateDohUrls } from '../../src/services/doh-balancer';
import { AppConfig } from '../../src/config';

describe('DoH Balancer Service', () => {
  const mockConfig: AppConfig = {
    dns: {
      dohUrls: [
        'https://cloudflare-dns.com/dns-query',
        'https://dns.google/resolve',
        'https://doh.opendns.com/dns-query'
      ],
      timeout: 10000,
      retries: 3
    },
    spf: {
      maxLookups: 10,
      maxRecordLength: 255,
      maxRecords: 1
    },
    server: {
      port: 8787,
      cors: {
        enabled: true,
        origins: ['*']
      }
    },
    logging: {
      level: 'info',
      enableRequestLogging: true
    }
  };

  describe('getRandomDohUrl', () => {
    it('should return a URL from the configured list', () => {
      const url = getRandomDohUrl(mockConfig);
      expect(mockConfig.dns.dohUrls).toContain(url);
    });

    it('should return different URLs on multiple calls (statistical test)', () => {
      const urls = new Set();
      for (let i = 0; i < 100; i++) {
        urls.add(getRandomDohUrl(mockConfig));
      }
      // With 3 URLs, we should get at least 2 different ones in 100 calls
      expect(urls.size).toBeGreaterThan(1);
    });

    it('should throw error when no DoH URLs are configured', () => {
      const emptyConfig: AppConfig = {
        ...mockConfig,
        dns: {
          ...mockConfig.dns,
          dohUrls: []
        }
      };

      expect(() => getRandomDohUrl(emptyConfig)).toThrow('No DoH URLs configured');
    });

    it('should work with single DoH URL', () => {
      const singleUrlConfig: AppConfig = {
        ...mockConfig,
        dns: {
          ...mockConfig.dns,
          dohUrls: ['https://cloudflare-dns.com/dns-query']
        }
      };

      const url = getRandomDohUrl(singleUrlConfig);
      expect(url).toBe('https://cloudflare-dns.com/dns-query');
    });

    it('should throw error when dohUrls is undefined', () => {
      const undefinedConfig: AppConfig = {
        ...mockConfig,
        dns: {
          ...mockConfig.dns,
          dohUrls: undefined as any
        }
      };

      expect(() => getRandomDohUrl(undefinedConfig)).toThrow('No DoH URLs configured');
    });
  });

  describe('getAllDohUrls', () => {
    it('should return all configured DoH URLs', () => {
      const urls = getAllDohUrls(mockConfig);
      expect(urls).toEqual(mockConfig.dns.dohUrls);
    });

    it('should return a copy of the array, not the original reference', () => {
      const urls = getAllDohUrls(mockConfig);
      expect(urls).not.toBe(mockConfig.dns.dohUrls);
      expect(urls).toEqual(mockConfig.dns.dohUrls);
    });

    it('should return empty array when no URLs are configured', () => {
      const emptyConfig: AppConfig = {
        ...mockConfig,
        dns: {
          ...mockConfig.dns,
          dohUrls: []
        }
      };

      const urls = getAllDohUrls(emptyConfig);
      expect(urls).toEqual([]);
    });
  });

  describe('validateDohUrls', () => {
    it('should return true for valid HTTPS URLs', () => {
      const validConfig: AppConfig = {
        ...mockConfig,
        dns: {
          ...mockConfig.dns,
          dohUrls: [
            'https://cloudflare-dns.com/dns-query',
            'https://dns.google/resolve'
          ]
        }
      };

      expect(validateDohUrls(validConfig)).toBe(true);
    });

    it('should return false for HTTP URLs', () => {
      const invalidConfig: AppConfig = {
        ...mockConfig,
        dns: {
          ...mockConfig.dns,
          dohUrls: [
            'http://cloudflare-dns.com/dns-query',
            'https://dns.google/resolve'
          ]
        }
      };

      expect(validateDohUrls(invalidConfig)).toBe(false);
    });

    it('should return false for invalid URLs', () => {
      const invalidConfig: AppConfig = {
        ...mockConfig,
        dns: {
          ...mockConfig.dns,
          dohUrls: [
            'not-a-url',
            'https://dns.google/resolve'
          ]
        }
      };

      expect(validateDohUrls(invalidConfig)).toBe(false);
    });

    it('should return false for empty array', () => {
      const emptyConfig: AppConfig = {
        ...mockConfig,
        dns: {
          ...mockConfig.dns,
          dohUrls: []
        }
      };

      expect(validateDohUrls(emptyConfig)).toBe(false);
    });

    it('should return false for undefined dohUrls', () => {
      const undefinedConfig: AppConfig = {
        ...mockConfig,
        dns: {
          ...mockConfig.dns,
          dohUrls: undefined as any
        }
      };

      expect(validateDohUrls(undefinedConfig)).toBe(false);
    });

    it('should return false for mixed valid and invalid URLs', () => {
      const mixedConfig: AppConfig = {
        ...mockConfig,
        dns: {
          ...mockConfig.dns,
          dohUrls: [
            'https://cloudflare-dns.com/dns-query',
            'http://invalid-url.com',
            'https://dns.google/resolve'
          ]
        }
      };

      expect(validateDohUrls(mixedConfig)).toBe(false);
    });
  });
}); 