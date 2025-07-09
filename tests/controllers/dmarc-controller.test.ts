import { DmarcController } from '../../src/controllers/dmarc-controller';
import { Context } from 'hono';
import { IDmarcService, DmarcRecord, DmarcValidationResult } from '../../src/types';
import { DmarcScorer } from '../../src/services/dmarc-scorer';

// Mock the DMARC scorer
jest.mock('../../src/services/dmarc-scorer');

const MockDmarcScorer = DmarcScorer as jest.MockedClass<typeof DmarcScorer>;

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: jest.fn(() => 'test-dmarc-request-id-789')
  }
});

// Mock Date.now for consistent responseTime testing
const mockDateNow = jest.fn();
jest.spyOn(global.Date, 'now').mockImplementation(mockDateNow);

describe('DMARC Controller', () => {
  let controller: DmarcController;
  let mockDmarcService: jest.Mocked<IDmarcService>;
  let mockContext: Partial<Context>;
  let mockScorer: jest.Mocked<DmarcScorer>;

  const mockDmarcRecord: DmarcRecord = {
    domain: 'example.com',
    rawRecord: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com',
    parsedData: {
      version: 'DMARC1',
      policy: 'quarantine',
      reportEmails: ['dmarc@example.com']
    },
    retrievedAt: new Date('2024-01-01T00:00:00Z')
  };

  const mockValidationResult: DmarcValidationResult = {
    domain: 'example.com',
    isValid: true,
    record: mockDmarcRecord,
    checks: {
      hasValidVersion: true,
      hasValidPolicy: true,
      hasValidSyntax: true,
      hasValidReportAddresses: true
    },
    issues: []
  };

  beforeEach(() => {
    // Reset mocks
    mockDateNow.mockReturnValue(1704067200000); // 2024-01-01T00:00:00Z
    
    // Create mock DMARC service
    mockDmarcService = {
      getDmarcRecord: jest.fn(),
      validateDmarcRecord: jest.fn(),
      parseDmarcRecord: jest.fn()
    };

    // Create mock scorer
    mockScorer = {
      calculateScore: jest.fn().mockReturnValue({
        totalScore: 85,
        maxPossibleScore: 100,
        percentage: 85,
        scoreItems: []
      })
    } as any;
    MockDmarcScorer.mockImplementation(() => mockScorer);

    // Create controller
    controller = new DmarcController(mockDmarcService);

    // Create mock context
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

  describe('getDmarcRecord', () => {
    it('should return DMARC record with requestId, responseTime, and timestamp', async () => {
      mockContext.req!.query = jest.fn().mockReturnValue('example.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockDmarcService.getDmarcRecord.mockResolvedValue(mockDmarcRecord);

      await controller.getDmarcRecord(mockContext as Context);

      expect(mockDmarcService.getDmarcRecord).toHaveBeenCalledWith('example.com');
      expect(mockScorer.calculateScore).toHaveBeenCalledWith(mockDmarcRecord);
      expect(mockContext.json).toHaveBeenCalledWith({
        record: mockDmarcRecord,
        score: {
          totalScore: 85,
          maxPossibleScore: 100,
          percentage: 85,
          scoreItems: []
        },
        requestId: 'test-dmarc-request-id-789',
        responseTime: expect.any(Number),
        timestamp: expect.any(String)
      });
    });

    it('should return 400 for missing domain parameter with requestId', async () => {
      mockContext.req!.query = jest.fn().mockReturnValue(undefined);
      mockContext.json = jest.fn().mockReturnValue(new Response());

      await controller.getDmarcRecord(mockContext as Context);

      expect(mockContext.json).toHaveBeenCalledWith({
        error: 'Domain parameter is required',
        requestId: 'test-dmarc-request-id-789'
      }, 400);
      expect(mockDmarcService.getDmarcRecord).not.toHaveBeenCalled();
    });

    it('should return 404 for no DMARC record found with all metadata', async () => {
      mockContext.req!.query = jest.fn().mockReturnValue('no-dmarc.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockDmarcService.getDmarcRecord.mockResolvedValue(null);

      await controller.getDmarcRecord(mockContext as Context);

      expect(mockContext.json).toHaveBeenCalledWith({
        error: 'No DMARC record found',
        requestId: 'test-dmarc-request-id-789',
        responseTime: expect.any(Number),
        timestamp: expect.any(String)
      }, 404);
    });

    it('should handle service errors with metadata', async () => {
      mockContext.req!.query = jest.fn().mockReturnValue('example.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockDmarcService.getDmarcRecord.mockRejectedValue(new Error('DNS query failed'));

      await controller.getDmarcRecord(mockContext as Context);

      expect(mockContext.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        requestId: 'test-dmarc-request-id-789',
        responseTime: expect.any(Number),
        timestamp: expect.any(String)
      }, 500);
    });

    it('should include responseTime in successful responses', async () => {
      mockContext.req!.query = jest.fn().mockReturnValue('example.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockDmarcService.getDmarcRecord.mockResolvedValue(mockDmarcRecord);

      await controller.getDmarcRecord(mockContext as Context);

      const response = (mockContext.json as jest.Mock).mock.calls[0][0];
      expect(response.responseTime).toBeGreaterThanOrEqual(0);
      expect(typeof response.responseTime).toBe('number');
    });

    it('should include ISO timestamp in successful responses', async () => {
      mockContext.req!.query = jest.fn().mockReturnValue('example.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockDmarcService.getDmarcRecord.mockResolvedValue(mockDmarcRecord);

      await controller.getDmarcRecord(mockContext as Context);

      const response = (mockContext.json as jest.Mock).mock.calls[0][0];
      expect(response.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('validateDmarcRecord', () => {
    it('should return validation result with requestId, responseTime, and timestamp', async () => {
      mockContext.req!.query = jest.fn().mockReturnValue('example.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockDmarcService.validateDmarcRecord.mockResolvedValue(mockValidationResult);

      await controller.validateDmarcRecord(mockContext as Context);

      expect(mockDmarcService.validateDmarcRecord).toHaveBeenCalledWith('example.com');
      expect(mockContext.json).toHaveBeenCalledWith({
        ...mockValidationResult,
        requestId: 'test-dmarc-request-id-789',
        responseTime: expect.any(Number),
        timestamp: expect.any(String)
      });
    });

    it('should return 400 for missing domain parameter with requestId', async () => {
      mockContext.req!.query = jest.fn().mockReturnValue(undefined);
      mockContext.json = jest.fn().mockReturnValue(new Response());

      await controller.validateDmarcRecord(mockContext as Context);

      expect(mockContext.json).toHaveBeenCalledWith({
        error: 'Domain parameter is required',
        requestId: 'test-dmarc-request-id-789'
      }, 400);
      expect(mockDmarcService.validateDmarcRecord).not.toHaveBeenCalled();
    });

    it('should handle validation errors with metadata', async () => {
      mockContext.req!.query = jest.fn().mockReturnValue('example.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockDmarcService.validateDmarcRecord.mockRejectedValue(new Error('Validation failed'));

      await controller.validateDmarcRecord(mockContext as Context);

      expect(mockContext.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        requestId: 'test-dmarc-request-id-789',
        responseTime: expect.any(Number),
        timestamp: expect.any(String)
      }, 500);
    });

    it('should include responseTime in validation responses', async () => {
      mockContext.req!.query = jest.fn().mockReturnValue('example.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockDmarcService.validateDmarcRecord.mockResolvedValue(mockValidationResult);

      await controller.validateDmarcRecord(mockContext as Context);

      const response = (mockContext.json as jest.Mock).mock.calls[0][0];
      expect(response.responseTime).toBeGreaterThanOrEqual(0);
      expect(typeof response.responseTime).toBe('number');
    });

    it('should include ISO timestamp in validation responses', async () => {
      mockContext.req!.query = jest.fn().mockReturnValue('example.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockDmarcService.validateDmarcRecord.mockResolvedValue(mockValidationResult);

      await controller.validateDmarcRecord(mockContext as Context);

      const response = (mockContext.json as jest.Mock).mock.calls[0][0];
      expect(response.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should handle invalid DMARC records', async () => {
      const invalidValidationResult: DmarcValidationResult = {
        domain: 'invalid.com',
        isValid: false,
        record: null,
        checks: {
          hasValidVersion: false,
          hasValidPolicy: false,
          hasValidSyntax: false,
          hasValidReportAddresses: false
        },
        issues: [{
          code: 'NO_DMARC_RECORD',
          message: 'No DMARC record found',
          severity: 'error'
        }]
      };

      mockContext.req!.query = jest.fn().mockReturnValue('invalid.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockDmarcService.validateDmarcRecord.mockResolvedValue(invalidValidationResult);

      await controller.validateDmarcRecord(mockContext as Context);

      const response = (mockContext.json as jest.Mock).mock.calls[0][0];
      expect(response.isValid).toBe(false);
      expect(response.issues).toHaveLength(1);
      expect(response.requestId).toBe('test-dmarc-request-id-789');
      expect(response.responseTime).toBeGreaterThanOrEqual(0);
      expect(response.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('Request Metadata', () => {
    it('should generate unique requestId for each request', async () => {
      mockContext.req!.query = jest.fn().mockReturnValue('example.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockDmarcService.getDmarcRecord.mockResolvedValue(mockDmarcRecord);

      await controller.getDmarcRecord(mockContext as Context);

      const response = (mockContext.json as jest.Mock).mock.calls[0][0];
      expect(response.requestId).toBe('test-dmarc-request-id-789');
    });

    it('should include user agent in logging', async () => {
      mockContext.req!.query = jest.fn().mockReturnValue('example.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockDmarcService.getDmarcRecord.mockResolvedValue(mockDmarcRecord);

      await controller.getDmarcRecord(mockContext as Context);

      expect(mockContext.req!.header).toHaveBeenCalledWith('User-Agent');
    });

    it('should handle unknown errors gracefully', async () => {
      mockContext.req!.query = jest.fn().mockReturnValue('example.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockDmarcService.getDmarcRecord.mockRejectedValue('string error');

      await controller.getDmarcRecord(mockContext as Context);

      expect(mockContext.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        requestId: 'test-dmarc-request-id-789',
        responseTime: expect.any(Number),
        timestamp: expect.any(String)
      }, 500);
    });
  });
}); 