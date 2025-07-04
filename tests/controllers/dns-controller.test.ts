import { createDnsController } from '../../src/controllers/dns-controller';
import { Context } from 'hono';
import { AppConfig } from '../../src/config';
import { TEST_CONFIG } from '../fixtures/test-data';
import * as dnsService from '../../src/services/dns-service';
import { ValidationError } from '../../src/utils/validation';

// Mock the DNS service
jest.mock('../../src/services/dns-service');
const mockDnsService = dnsService as jest.Mocked<typeof dnsService>;

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: jest.fn(() => 'test-request-id-123')
  }
});

describe('DNS Controller', () => {
  let controller: (c: Context) => Promise<Response>;
  let mockContext: Partial<Context>;
  const testConfig: AppConfig = TEST_CONFIG;

  beforeEach(() => {
    controller = createDnsController(testConfig);
    
    // Create a mock context
    mockContext = {
      req: {
        query: jest.fn(),
        header: jest.fn().mockReturnValue('test-user-agent')
      } as any,
      json: jest.fn()
    };
    
    jest.clearAllMocks();
    
    // Suppress console logs for cleaner test output
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Request Handling', () => {
    it('should handle valid domain requests', async () => {
      const mockResult = {
        domain: 'example.com',
        isRegistered: true,
        dnsResponse: { Status: 0, Answer: [{ name: 'example.com', type: 1, TTL: 300, data: '93.184.216.34' }] },
        queryTime: 150
      };

      mockContext.req!.query = jest.fn().mockReturnValue('example.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockDnsService.checkDnsRegistration.mockResolvedValue(mockResult);

      await controller(mockContext as Context);

      expect(mockDnsService.checkDnsRegistration).toHaveBeenCalledWith('example.com', testConfig);
      expect(mockContext.json).toHaveBeenCalledWith({
        domain: 'example.com',
        isRegistered: true,
        dnsResponse: { Status: 0, Answer: [{ name: 'example.com', type: 1, TTL: 300, data: '93.184.216.34' }] },
        queryTime: 150,
        requestId: 'test-request-id-123',
        responseTime: expect.any(Number),
        timestamp: expect.any(String)
      });
    });

    it('should return 400 for missing domain parameter', async () => {
      mockContext.req!.query = jest.fn().mockReturnValue(undefined);
      mockContext.json = jest.fn().mockReturnValue(new Response());

      await controller(mockContext as Context);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: 'Domain parameter is required',
          requestId: 'test-request-id-123'
        },
        400
      );
      expect(mockDnsService.checkDnsRegistration).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid domain format', async () => {
      mockContext.req!.query = jest.fn().mockReturnValue('invalid-domain');
      mockContext.json = jest.fn().mockReturnValue(new Response());

      await controller(mockContext as Context);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: 'Invalid domain format',
          field: 'domain',
          requestId: 'test-request-id-123'
        },
        400
      );
      expect(mockDnsService.checkDnsRegistration).not.toHaveBeenCalled();
    });

    it('should sanitize domain input', async () => {
      const mockResult = {
        domain: 'example.com',
        isRegistered: true,
        dnsResponse: { Status: 0, Answer: [] },
        queryTime: 100
      };

      mockContext.req!.query = jest.fn().mockReturnValue('  EXAMPLE.COM  ');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockDnsService.checkDnsRegistration.mockResolvedValue(mockResult);

      await controller(mockContext as Context);

      expect(mockDnsService.checkDnsRegistration).toHaveBeenCalledWith('example.com', testConfig);
    });

    it('should include request metadata in response', async () => {
      const mockResult = {
        domain: 'example.com',
        isRegistered: true,
        dnsResponse: { Status: 0, Answer: [] },
        queryTime: 100
      };

      mockContext.req!.query = jest.fn().mockReturnValue('example.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockDnsService.checkDnsRegistration.mockResolvedValue(mockResult);

      await controller(mockContext as Context);

      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'test-request-id-123',
          responseTime: expect.any(Number),
          timestamp: expect.any(String)
        })
      );
    });

    it('should handle DNS service errors gracefully', async () => {
      mockContext.req!.query = jest.fn().mockReturnValue('example.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockDnsService.checkDnsRegistration.mockRejectedValue(new Error('DNS service unavailable'));

      await controller(mockContext as Context);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: 'DNS service unavailable',
          requestId: 'test-request-id-123',
          responseTime: expect.any(Number),
          timestamp: expect.any(String)
        },
        500
      );
    });

    it('should return appropriate status codes', async () => {
      // Test successful response
      const mockResult = {
        domain: 'example.com',
        isRegistered: true,
        dnsResponse: { Status: 0, Answer: [] },
        queryTime: 100
      };

      mockContext.req!.query = jest.fn().mockReturnValue('example.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockDnsService.checkDnsRegistration.mockResolvedValue(mockResult);

      await controller(mockContext as Context);

      // For successful requests, json is called without a status code (defaults to 200)
      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: 'example.com',
          isRegistered: true
        })
      );
    });

    it('should measure and return response times', async () => {
      const mockResult = {
        domain: 'example.com',
        isRegistered: true,
        dnsResponse: { Status: 0, Answer: [] },
        queryTime: 100
      };

      mockContext.req!.query = jest.fn().mockReturnValue('example.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockDnsService.checkDnsRegistration.mockResolvedValue(mockResult);

      const startTime = Date.now();
      await controller(mockContext as Context);
      const endTime = Date.now();

      const response = (mockContext.json as jest.Mock).mock.calls[0][0];
      expect(response.responseTime).toBeGreaterThanOrEqual(0);
      expect(response.responseTime).toBeLessThanOrEqual(endTime - startTime + 10); // Allow small buffer
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors', async () => {
      mockContext.req!.query = jest.fn().mockReturnValue('');
      mockContext.json = jest.fn().mockReturnValue(new Response());

      await controller(mockContext as Context);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: 'Domain parameter is required',
          requestId: 'test-request-id-123'
        },
        400
      );
    });

    it('should handle DNS timeout errors with 504 status', async () => {
      mockContext.req!.query = jest.fn().mockReturnValue('example.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockDnsService.checkDnsRegistration.mockRejectedValue(new Error('DNS query timeout'));

      await controller(mockContext as Context);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: 'DNS query timeout',
          requestId: 'test-request-id-123',
          responseTime: expect.any(Number),
          timestamp: expect.any(String)
        },
        504
      );
    });

    it('should handle unexpected errors with 500 status', async () => {
      mockContext.req!.query = jest.fn().mockReturnValue('example.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockDnsService.checkDnsRegistration.mockRejectedValue(new Error('Unexpected error'));

      await controller(mockContext as Context);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: 'Unexpected error',
          requestId: 'test-request-id-123',
          responseTime: expect.any(Number),
          timestamp: expect.any(String)
        },
        500
      );
    });

    it('should include request ID in all responses', async () => {
      // Test error response
      mockContext.req!.query = jest.fn().mockReturnValue(undefined);
      mockContext.json = jest.fn().mockReturnValue(new Response());

      await controller(mockContext as Context);

      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'test-request-id-123'
        }),
        400
      );
    });

    it('should handle unknown errors gracefully', async () => {
      mockContext.req!.query = jest.fn().mockReturnValue('example.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockDnsService.checkDnsRegistration.mockRejectedValue('string error');

      await controller(mockContext as Context);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: 'An unknown error occurred',
          requestId: 'test-request-id-123',
          responseTime: expect.any(Number),
          timestamp: expect.any(String)
        },
        500
      );
    });
  });

  describe('Logging', () => {
    it('should log request start and completion', async () => {
      const loggerInfoSpy = jest.spyOn(console, 'info');
      
      const mockResult = {
        domain: 'example.com',
        isRegistered: true,
        dnsResponse: { Status: 0, Answer: [] },
        queryTime: 100
      };

      mockContext.req!.query = jest.fn().mockReturnValue('example.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockDnsService.checkDnsRegistration.mockResolvedValue(mockResult);

      await controller(mockContext as Context);

      // Check that logging occurred (console.info was called)
      expect(loggerInfoSpy).toHaveBeenCalled();
    });

    it('should log errors with appropriate context', async () => {
      const loggerErrorSpy = jest.spyOn(console, 'error');
      
      mockContext.req!.query = jest.fn().mockReturnValue('example.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockDnsService.checkDnsRegistration.mockRejectedValue(new Error('DNS service error'));

      await controller(mockContext as Context);

      // Check that error logging occurred
      expect(loggerErrorSpy).toHaveBeenCalled();
    });

    it('should include performance metrics in logs', async () => {
      const loggerInfoSpy = jest.spyOn(console, 'info');
      
      const mockResult = {
        domain: 'example.com',
        isRegistered: true,
        dnsResponse: { Status: 0, Answer: [] },
        queryTime: 100
      };

      mockContext.req!.query = jest.fn().mockReturnValue('example.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockDnsService.checkDnsRegistration.mockResolvedValue(mockResult);

      await controller(mockContext as Context);

      // Verify that performance metrics are included in logs
      expect(loggerInfoSpy).toHaveBeenCalled();
      
      // Check that at least one logged message includes performance metrics
      const logCalls = loggerInfoSpy.mock.calls;
      const hasPerformanceMetrics = logCalls.some(call => 
        call[0] && typeof call[0] === 'string' && 
        (call[0].includes('responseTime') || call[0].includes('queryTime'))
      );
      expect(hasPerformanceMetrics).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string domain', async () => {
      mockContext.req!.query = jest.fn().mockReturnValue('');
      mockContext.json = jest.fn().mockReturnValue(new Response());

      await controller(mockContext as Context);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: 'Domain parameter is required',
          requestId: 'test-request-id-123'
        },
        400
      );
    });

    it('should handle whitespace-only domain', async () => {
      mockContext.req!.query = jest.fn().mockReturnValue('   ');
      mockContext.json = jest.fn().mockReturnValue(new Response());

      await controller(mockContext as Context);

      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Domain')
        }),
        400
      );
    });

    it('should handle very long domain names', async () => {
      const longDomain = 'a'.repeat(300) + '.com';
      mockContext.req!.query = jest.fn().mockReturnValue(longDomain);
      mockContext.json = jest.fn().mockReturnValue(new Response());

      await controller(mockContext as Context);

      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Domain')
        }),
        400
      );
    });

    it('should handle missing User-Agent header', async () => {
      const mockResult = {
        domain: 'example.com',
        isRegistered: true,
        dnsResponse: { Status: 0, Answer: [] },
        queryTime: 100
      };

      mockContext.req!.query = jest.fn().mockReturnValue('example.com');
      mockContext.req!.header = jest.fn().mockReturnValue(undefined);
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockDnsService.checkDnsRegistration.mockResolvedValue(mockResult);

      await controller(mockContext as Context);

      // Should still work without User-Agent
      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: 'example.com',
          isRegistered: true
        })
      );
    });
  });
});