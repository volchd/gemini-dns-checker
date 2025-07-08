import { getConfig, AppConfig } from '../src/config';

describe('Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env for each test
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Default Config', () => {
    it('should have valid default values', () => {
      const config = getConfig();
      
      expect(config).toBeDefined();
      expect(config.dns).toBeDefined();
      expect(config.spf).toBeDefined();
      expect(config.server).toBeDefined();
      expect(config.logging).toBeDefined();
    });

    it('should include all required config sections', () => {
      const config = getConfig();
      
      // DNS section
      expect(config.dns).toHaveProperty('dohUrls');
      expect(config.dns).toHaveProperty('timeout');
      expect(config.dns).toHaveProperty('retries');
      
      // SPF section
      expect(config.spf).toHaveProperty('maxLookups');
      expect(config.spf).toHaveProperty('maxRecordLength');
      expect(config.spf).toHaveProperty('maxRecords');
      
      // Server section
      expect(config.server).toHaveProperty('port');
      expect(config.server).toHaveProperty('cors');
      expect(config.server.cors).toHaveProperty('enabled');
      expect(config.server.cors).toHaveProperty('origins');
      
      // Logging section
      expect(config.logging).toHaveProperty('level');
      expect(config.logging).toHaveProperty('enableRequestLogging');
    });

    it('should have sensible default values', () => {
      const config = getConfig();
      
      // DNS defaults
      expect(config.dns.dohUrls).toEqual([
        'https://dns.google/resolve', 
        'https://cloudflare-dns.com/dns-query',
        'https://unfiltered.adguard-dns.com/resolve'
      ]);
      expect(config.dns.timeout).toBe(10000);
      expect(config.dns.retries).toBe(3);
      
      // SPF defaults
      expect(config.spf.maxLookups).toBe(10);
      expect(config.spf.maxRecordLength).toBe(255);
      expect(config.spf.maxRecords).toBe(1);
      
      // Server defaults
      expect(config.server.port).toBe(8787);
      expect(config.server.cors.enabled).toBe(true);
      expect(config.server.cors.origins).toEqual(['*']);
      
      // Logging defaults
      expect(config.logging.level).toBe('info');
      expect(config.logging.enableRequestLogging).toBe(true);
    });

    it('should return consistent config objects', () => {
      const config1 = getConfig();
      const config2 = getConfig();
      
      expect(config1).toEqual(config2);
    });
  });

  describe('Environment Override', () => {
    it('should override DNS settings from environment', () => {
      const env = {
        DOH_URL: 'https://custom-dns.example.com/dns-query',
        DNS_TIMEOUT: '5000',
        DNS_RETRIES: '5'
      };
      
      const config = getConfig(env);
      
      expect(config.dns.dohUrls).toEqual(['https://custom-dns.example.com/dns-query']);
      expect(config.dns.timeout).toBe(5000);
      expect(config.dns.retries).toBe(5);
    });

    it('should override logging settings from environment', () => {
      const env = {
        LOG_LEVEL: 'debug'
      };
      
      const config = getConfig(env);
      
      expect(config.logging.level).toBe('debug');
    });

    it('should handle invalid environment values gracefully', () => {
      const env = {
        DNS_TIMEOUT: 'invalid-number',
        DNS_RETRIES: 'also-invalid',
        LOG_LEVEL: 'invalid-level'
      };
      
      const config = getConfig(env);
      
      // Should fall back to defaults or parse as NaN
      expect(isNaN(config.dns.timeout)).toBe(true);
      expect(isNaN(config.dns.retries)).toBe(true);
      expect(config.logging.level).toBe('invalid-level'); // This gets passed through
    });

    it('should preserve defaults for unset environment variables', () => {
      const env = {
        DOH_URL: 'https://custom-dns.example.com/dns-query'
        // DNS_TIMEOUT and DNS_RETRIES not set
      };
      
      const config = getConfig(env);
      
      expect(config.dns.dohUrls).toEqual(['https://custom-dns.example.com/dns-query']);
      expect(config.dns.timeout).toBe(10000); // default
      expect(config.dns.retries).toBe(3); // default
    });

    it('should handle empty environment object', () => {
      const config = getConfig({});
      
      // Should be same as default config
      const defaultConfig = getConfig();
      expect(config).toEqual(defaultConfig);
    });

    it('should handle undefined environment', () => {
      const config = getConfig(undefined);
      
      // Should be same as default config
      const defaultConfig = getConfig();
      expect(config).toEqual(defaultConfig);
    });

    it('should handle partial environment overrides', () => {
      const env = {
        DNS_TIMEOUT: '15000'
        // Only override timeout, leave others as default
      };
      
      const config = getConfig(env);
      
      expect(config.dns.dohUrls).toEqual([
        'https://dns.google/resolve', 
        'https://cloudflare-dns.com/dns-query',
        'https://unfiltered.adguard-dns.com/resolve'
      ]); // default
      expect(config.dns.timeout).toBe(15000); // overridden
      expect(config.dns.retries).toBe(3); // default
    });
  });

  describe('Validation', () => {
    it('should validate timeout values', () => {
      const validTimeouts = ['1000', '5000', '30000'];
      
      validTimeouts.forEach(timeout => {
        const env = { DNS_TIMEOUT: timeout };
        const config = getConfig(env);
        
        expect(config.dns.timeout).toBe(parseInt(timeout));
        expect(config.dns.timeout).toBeGreaterThan(0);
      });
    });

    it('should validate retry counts', () => {
      const validRetries = ['1', '3', '5', '10'];
      
      validRetries.forEach(retries => {
        const env = { DNS_RETRIES: retries };
        const config = getConfig(env);
        
        expect(config.spf.maxRecords).toBe(1); // Should remain default
        expect(config.dns.retries).toBe(parseInt(retries));
        expect(config.dns.retries).toBeGreaterThan(0);
      });
    });

    it('should validate log levels', () => {
      const validLevels = ['debug', 'info', 'warn', 'error'];
      
      validLevels.forEach(level => {
        const env = { LOG_LEVEL: level };
        const config = getConfig(env);
        
        expect(config.logging.level).toBe(level);
      });
    });

    it('should handle edge case values', () => {
      const env = {
        DNS_TIMEOUT: '0',
        DNS_RETRIES: '0',
        LOG_LEVEL: '' // Empty string should fall back to default
      };
      
      const config = getConfig(env);
      
      expect(config.dns.timeout).toBe(0);
      expect(config.dns.retries).toBe(0);
      expect(config.logging.level).toBe('info'); // Should fall back to default
    });

    it('should handle very large numbers', () => {
      const env = {
        DNS_TIMEOUT: '999999999',
        DNS_RETRIES: '100'
      };
      
      const config = getConfig(env);
      
      expect(config.dns.timeout).toBe(999999999);
      expect(config.dns.retries).toBe(100);
    });

    it('should handle negative numbers', () => {
      const env = {
        DNS_TIMEOUT: '-1000',
        DNS_RETRIES: '-5'
      };
      
      const config = getConfig(env);
      
      expect(config.dns.timeout).toBe(-1000);
      expect(config.dns.retries).toBe(-5);
    });

    it('should handle floating point numbers', () => {
      const env = {
        DNS_TIMEOUT: '5000.5',
        DNS_RETRIES: '3.14'
      };
      
      const config = getConfig(env);
      
      expect(config.dns.timeout).toBe(5000); // parseInt truncates
      expect(config.dns.retries).toBe(3); // parseInt truncates
    });

    it('should preserve non-overridable config sections', () => {
      const env = {
        DOH_URL: 'https://custom-dns.example.com/dns-query',
        DNS_TIMEOUT: '5000',
        LOG_LEVEL: 'debug'
      };
      
      const config = getConfig(env);
      
      // These sections should remain unchanged by environment variables
      expect(config.spf.maxLookups).toBe(10);
      expect(config.spf.maxRecordLength).toBe(255);
      expect(config.spf.maxRecords).toBe(1);
      
      expect(config.server.port).toBe(8787);
      expect(config.server.cors.enabled).toBe(true);
      expect(config.server.cors.origins).toEqual(['*']);
      
      expect(config.logging.enableRequestLogging).toBe(true);
    });

    it('should handle empty string values', () => {
      const env = {
        DOH_URL: '', // Empty strings fall back to defaults because '' || 'default' === 'default'
        DNS_TIMEOUT: '',
        DNS_RETRIES: '',
        LOG_LEVEL: ''
      };
      
      const config = getConfig(env);
      
      expect(config.dns.dohUrls).toEqual([
        'https://dns.google/resolve', 
        'https://cloudflare-dns.com/dns-query',
        'https://unfiltered.adguard-dns.com/resolve'
      ]); // Falls back to default
      expect(config.dns.timeout).toBe(10000); // Falls back to default, then parsed as valid number
      expect(config.dns.retries).toBe(3); // Falls back to default, then parsed as valid number
      expect(config.logging.level).toBe('info'); // Falls back to default
    });
  });

  describe('Type Safety', () => {
    it('should return correctly typed config object', () => {
      const config: AppConfig = getConfig();
      
      // TypeScript should enforce these types
      expect(typeof config.dns.dohUrls[0]).toBe('string');
      expect(typeof config.dns.timeout).toBe('number');
      expect(typeof config.dns.retries).toBe('number');
      
      expect(typeof config.spf.maxLookups).toBe('number');
      expect(typeof config.spf.maxRecordLength).toBe('number');
      expect(typeof config.spf.maxRecords).toBe('number');
      
      expect(typeof config.server.port).toBe('number');
      expect(typeof config.server.cors.enabled).toBe('boolean');
      expect(Array.isArray(config.server.cors.origins)).toBe(true);
      
      expect(typeof config.logging.level).toBe('string');
      expect(typeof config.logging.enableRequestLogging).toBe('boolean');
    });

    it('should handle type conversions correctly', () => {
      const env = {
        DNS_TIMEOUT: '5000', // string to number
        LOG_LEVEL: 'debug'   // string to string
      };
      
      const config = getConfig(env);
      
      expect(typeof config.dns.timeout).toBe('number');
      expect(config.dns.timeout).toBe(5000);
      expect(typeof config.logging.level).toBe('string');
      expect(config.logging.level).toBe('debug');
    });
  });

  describe('Real Environment Scenarios', () => {
    it('should work with typical production environment', () => {
      const prodEnv = {
        DOH_URL: 'https://1.1.1.1/dns-query',
        DNS_TIMEOUT: '30000',
        DNS_RETRIES: '5',
        LOG_LEVEL: 'warn'
      };
      
      const config = getConfig(prodEnv);
      
      expect(config.dns.dohUrls).toEqual(['https://1.1.1.1/dns-query']);
      expect(config.dns.timeout).toBe(30000);
      expect(config.dns.retries).toBe(5);
      expect(config.logging.level).toBe('warn');
    });

    it('should work with typical development environment', () => {
      const devEnv = {
        DNS_TIMEOUT: '5000',
        LOG_LEVEL: 'debug'
      };
      
      const config = getConfig(devEnv);
      
      expect(config.dns.dohUrls).toEqual([
        'https://dns.google/resolve', 
        'https://cloudflare-dns.com/dns-query',
        'https://unfiltered.adguard-dns.com/resolve'
      ]); // default
      expect(config.dns.timeout).toBe(5000);
      expect(config.dns.retries).toBe(3); // default
      expect(config.logging.level).toBe('debug');
    });

    it('should work with Cloudflare Workers environment', () => {
      const workersEnv = {
        DOH_URL: 'https://cloudflare-dns.com/dns-query',
        DNS_TIMEOUT: '10000',
        DNS_RETRIES: '3',
        LOG_LEVEL: 'info'
      };
      
      const config = getConfig(workersEnv);
      
      expect(config.dns.dohUrls).toEqual(['https://cloudflare-dns.com/dns-query']);
      expect(config.dns.timeout).toBe(10000);
      expect(config.dns.retries).toBe(3);
      expect(config.logging.level).toBe('info');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long URLs', () => {
      const longUrl = 'https://' + 'a'.repeat(1000) + '.example.com/dns-query';
      const env = { DOH_URL: longUrl };
      
      const config = getConfig(env);
      
      expect(config.dns.dohUrls).toEqual([longUrl]);
    });

    it('should handle special characters in URL', () => {
      const specialUrl = 'https://dns.example.com/dns-query?param=value&other=123';
      const env = { DOH_URL: specialUrl };
      
      const config = getConfig(env);
      
      expect(config.dns.dohUrls).toEqual([specialUrl]);
    });

    it('should handle whitespace in values', () => {
      const env = {
        DOH_URL: '  https://dns.example.com/dns-query  ',
        DNS_TIMEOUT: '  5000  ',
        LOG_LEVEL: '  debug  '
      };
      
      const config = getConfig(env);
      
      expect(config.dns.dohUrls).toEqual(['  https://dns.example.com/dns-query  ']);
      expect(config.dns.timeout).toBe(5000); // parseInt handles whitespace
      expect(config.logging.level).toBe('  debug  ');
    });
  });
});