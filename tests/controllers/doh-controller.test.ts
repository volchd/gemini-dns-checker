import { Context } from 'hono';
import { createDohController, createDohListController } from '../../src/controllers/doh-controller';
import { AppConfig } from '../../src/config';

// Mock the logger to avoid console output during tests
jest.mock('../../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn()
  }
}));

describe('DoH Controller', () => {
  const mockConfig: AppConfig = {
    dns: {
      dohUrls: [
        'https://dns.google/resolve',
        'https://cloudflare-dns.com/dns-query',
        'https://unfiltered.adguard-dns.com/resolve'
      ],
      timeout: 5000,
      retries: 2
    },
    spf: {
      maxLookups: 10,
      maxRecordLength: 255,
      maxRecords: 1
    },
    dkim: {
      commonSelectors: ['selector1', 'selector2', 'google', 'default']
    },
    server: {
      port: 8787,
      cors: {
        enabled: true,
        origins: ['*']
      }
    },
    logging: {
      level: 'debug',
      enableRequestLogging: true
    }
  };

  const createMockContext = () => {
    return {
      json: jest.fn().mockReturnThis(),
      req: {
        path: '/doh-url',
        method: 'GET'
      }
    } as any;
  };

  describe('createDohController', () => {
    it('should return a random DoH URL', async () => {
      const controller = createDohController(mockConfig);
      const mockCtx = createMockContext();
      const jsonSpy = jest.spyOn(mockCtx, 'json');

      await controller(mockCtx);

      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.any(String),
          totalProviders: 3,
          timestamp: expect.any(String)
        })
      );

      const response = jsonSpy.mock.calls[0][0] as any;
      expect(mockConfig.dns.dohUrls).toContain(response.url);
    });

    it('should return 500 error for invalid DoH URLs configuration', async () => {
      const invalidConfig: AppConfig = {
        ...mockConfig,
        dns: {
          ...mockConfig.dns,
          dohUrls: ['http://invalid-url.com']
        }
      };

      const controller = createDohController(invalidConfig);
      const mockCtx = createMockContext();
      const jsonSpy = jest.spyOn(mockCtx, 'json');

      await controller(mockCtx);

      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid DoH URLs configuration',
          timestamp: expect.any(String)
        }),
        500
      );
    });

    it('should return 500 error for empty DoH URLs configuration', async () => {
      const emptyConfig: AppConfig = {
        ...mockConfig,
        dns: {
          ...mockConfig.dns,
          dohUrls: []
        }
      };

      const controller = createDohController(emptyConfig);
      const mockCtx = createMockContext();
      const jsonSpy = jest.spyOn(mockCtx, 'json');

      await controller(mockCtx);

      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid DoH URLs configuration',
          timestamp: expect.any(String)
        }),
        500
      );
    });

    it('should handle errors gracefully', async () => {
      // Spy on the balancer to throw an error
      const balancer = require('../../src/services/doh-balancer');
      jest.spyOn(balancer, 'getRandomDohUrl').mockImplementation(() => { throw new Error('Test error'); });
      jest.spyOn(balancer, 'validateDohUrls').mockReturnValue(true);

      const controller = createDohController(mockConfig);
      const mockCtx = createMockContext();
      const jsonSpy = jest.spyOn(mockCtx, 'json');

      await controller(mockCtx);

      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Failed to get DoH URL',
          message: 'Test error',
          timestamp: expect.any(String)
        }),
        500
      );

      jest.restoreAllMocks();
    });
  });

  describe('createDohListController', () => {
    it('should return all configured DoH URLs', async () => {
      const controller = createDohListController(mockConfig);
      const mockCtx = createMockContext();
      const jsonSpy = jest.spyOn(mockCtx, 'json');

      await controller(mockCtx);

      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          urls: mockConfig.dns.dohUrls,
          totalProviders: 3,
          timestamp: expect.any(String)
        })
      );
    });

    it('should return 500 error for invalid DoH URLs configuration', async () => {
      const invalidConfig: AppConfig = {
        ...mockConfig,
        dns: {
          ...mockConfig.dns,
          dohUrls: ['http://invalid-url.com']
        }
      };

      const controller = createDohListController(invalidConfig);
      const mockCtx = createMockContext();
      const jsonSpy = jest.spyOn(mockCtx, 'json');

      await controller(mockCtx);

      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid DoH URLs configuration',
          timestamp: expect.any(String)
        }),
        500
      );
    });

    it('should return 500 error for empty DoH URLs configuration', async () => {
      const emptyConfig: AppConfig = {
        ...mockConfig,
        dns: {
          ...mockConfig.dns,
          dohUrls: []
        }
      };

      const controller = createDohListController(emptyConfig);
      const mockCtx = createMockContext();
      const jsonSpy = jest.spyOn(mockCtx, 'json');

      await controller(mockCtx);

      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid DoH URLs configuration',
          timestamp: expect.any(String)
        }),
        500
      );
    });

    it('should handle errors gracefully', async () => {
      // Spy on the balancer to throw an error
      const balancer = require('../../src/services/doh-balancer');
      jest.spyOn(balancer, 'getAllDohUrls').mockImplementation(() => { throw new Error('Test error'); });
      jest.spyOn(balancer, 'validateDohUrls').mockReturnValue(true);

      const controller = createDohListController(mockConfig);
      const mockCtx = createMockContext();
      const jsonSpy = jest.spyOn(mockCtx, 'json');

      await controller(mockCtx);

      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Failed to get DoH URLs',
          message: 'Test error',
          timestamp: expect.any(String)
        }),
        500
      );

      jest.restoreAllMocks();
    });
  });
}); 