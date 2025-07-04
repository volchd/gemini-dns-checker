import { createSpfController } from '../../src/controllers/spf-controller';
import { Context } from 'hono';
import { AppConfig } from '../../src/config';
import { TEST_CONFIG, MOCK_SPF_RECORDS } from '../fixtures/test-data';
import { SpfRecordObject, SpfValidationResults } from '../../src/types';
import * as spfService from '../../src/services/spf-service';
import { SpfValidator } from '../../src/services/spf-validator';

// Mock the SPF service and validator
jest.mock('../../src/services/spf-service');
jest.mock('../../src/services/spf-validator');

const mockSpfService = spfService as jest.Mocked<typeof spfService>;
const MockSpfValidator = SpfValidator as jest.MockedClass<typeof SpfValidator>;

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: jest.fn(() => 'test-spf-request-id-456')
  }
});

describe('SPF Controller', () => {
  let controller: (c: Context) => Promise<Response>;
  let mockContext: Partial<Context>;
  let mockValidator: jest.Mocked<SpfValidator>;
  const testConfig: AppConfig = TEST_CONFIG;

  beforeEach(() => {
    controller = createSpfController(testConfig);
    
    // Create mock validator instance
    mockValidator = {
      validate: jest.fn()
    } as any;
    MockSpfValidator.mockImplementation(() => mockValidator);
    
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
    it('should handle valid SPF validation requests', async () => {
      const mockSpfRecords: SpfRecordObject[] = [MOCK_SPF_RECORDS.basic];
      const mockValidationResults: SpfValidationResults = {
        hasSpfRecord: { isValid: true },
        syntaxValidation: { isValid: true, errors: [] },
        oneInitialSpfRecord: { isValid: true },
        maxTenSpfRecords: { isValid: true },
        deprecatedMechanisms: { isValid: true, errors: [] },
        unsafeAllMechanism: { isValid: true, errors: [] },
        firstAllQualifier: { qualifier: '~' }
      };

      mockContext.req!.query = jest.fn().mockReturnValue('example.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockSpfService.getSpfRecord.mockResolvedValue(mockSpfRecords);
      mockValidator.validate.mockReturnValue(mockValidationResults);

      await controller(mockContext as Context);

      expect(mockSpfService.getSpfRecord).toHaveBeenCalledWith(
        'example.com', 
        new Set(), 
        'initial', 
        testConfig
      );
      expect(mockValidator.validate).toHaveBeenCalledWith(mockSpfRecords);
      expect(mockContext.json).toHaveBeenCalledWith({
        domain: 'example.com',
        spfRecords: mockSpfRecords,
        validationResults: mockValidationResults,
        requestId: 'test-spf-request-id-456',
        responseTime: expect.any(Number),
        timestamp: expect.any(String)
      });
    });

    it('should return complete SPF analysis', async () => {
      const mockSpfRecords: SpfRecordObject[] = [
        MOCK_SPF_RECORDS.basic,
        MOCK_SPF_RECORDS.included
      ];
      const mockValidationResults: SpfValidationResults = {
        hasSpfRecord: { isValid: true },
        syntaxValidation: { isValid: true, errors: [] },
        oneInitialSpfRecord: { isValid: true },
        maxTenSpfRecords: { isValid: true },
        deprecatedMechanisms: { isValid: true, errors: [] },
        unsafeAllMechanism: { isValid: true, errors: [] },
        firstAllQualifier: { qualifier: '~' }
      };

      mockContext.req!.query = jest.fn().mockReturnValue('example.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockSpfService.getSpfRecord.mockResolvedValue(mockSpfRecords);
      mockValidator.validate.mockReturnValue(mockValidationResults);

      await controller(mockContext as Context);

      const response = (mockContext.json as jest.Mock).mock.calls[0][0];
      
      expect(response).toHaveProperty('domain', 'example.com');
      expect(response).toHaveProperty('spfRecords');
      expect(response).toHaveProperty('validationResults');
      expect(response).toHaveProperty('requestId');
      expect(response).toHaveProperty('responseTime');
      expect(response).toHaveProperty('timestamp');
      expect(response.spfRecords).toHaveLength(2);
    });

    it('should include all validation results', async () => {
      const mockSpfRecords: SpfRecordObject[] = [MOCK_SPF_RECORDS.basic];
      const mockValidationResults: SpfValidationResults = {
        hasSpfRecord: { isValid: true },
        syntaxValidation: { isValid: false, errors: [{ record: MOCK_SPF_RECORDS.basic, error: 'Test error' }] },
        oneInitialSpfRecord: { isValid: true },
        maxTenSpfRecords: { isValid: false, message: 'Too many records' },
        deprecatedMechanisms: { isValid: false, errors: [{ record: MOCK_SPF_RECORDS.basic, error: 'Deprecated ptr' }] },
        unsafeAllMechanism: { isValid: false, errors: [{ record: MOCK_SPF_RECORDS.basic, error: 'Unsafe +all' }] },
        firstAllQualifier: { qualifier: '+', message: 'Unsafe qualifier' }
      };

      mockContext.req!.query = jest.fn().mockReturnValue('example.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockSpfService.getSpfRecord.mockResolvedValue(mockSpfRecords);
      mockValidator.validate.mockReturnValue(mockValidationResults);

      await controller(mockContext as Context);

      const response = (mockContext.json as jest.Mock).mock.calls[0][0];
      const validationResults = response.validationResults;
      
      expect(validationResults).toHaveProperty('hasSpfRecord');
      expect(validationResults).toHaveProperty('syntaxValidation');
      expect(validationResults).toHaveProperty('oneInitialSpfRecord');
      expect(validationResults).toHaveProperty('maxTenSpfRecords');
      expect(validationResults).toHaveProperty('deprecatedMechanisms');
      expect(validationResults).toHaveProperty('unsafeAllMechanism');
      expect(validationResults).toHaveProperty('firstAllQualifier');
      
      expect(validationResults.syntaxValidation.errors).toHaveLength(1);
      expect(validationResults.deprecatedMechanisms.errors).toHaveLength(1);
      expect(validationResults.unsafeAllMechanism.errors).toHaveLength(1);
    });

    it('should handle domains with no SPF records', async () => {
      const mockSpfRecords: SpfRecordObject[] = [];
      const mockValidationResults: SpfValidationResults = {
        hasSpfRecord: { isValid: false, message: 'No SPF record found' },
        syntaxValidation: { isValid: false, errors: [] },
        oneInitialSpfRecord: { isValid: false },
        maxTenSpfRecords: { isValid: false },
        deprecatedMechanisms: { isValid: false, errors: [] },
        unsafeAllMechanism: { isValid: false, errors: [] },
        firstAllQualifier: { qualifier: null }
      };

      mockContext.req!.query = jest.fn().mockReturnValue('no-spf-domain.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockSpfService.getSpfRecord.mockResolvedValue(mockSpfRecords);
      mockValidator.validate.mockReturnValue(mockValidationResults);

      await controller(mockContext as Context);

      const response = (mockContext.json as jest.Mock).mock.calls[0][0];
      
      expect(response.spfRecords).toHaveLength(0);
      expect(response.validationResults.hasSpfRecord.isValid).toBe(false);
    });

    it('should handle domains with complex SPF chains', async () => {
      const mockSpfRecords: SpfRecordObject[] = [
        MOCK_SPF_RECORDS.withInclude,
        MOCK_SPF_RECORDS.included,
        { ...MOCK_SPF_RECORDS.included, domain: 'backup.example.com', type: 'include' }
      ];
      const mockValidationResults: SpfValidationResults = {
        hasSpfRecord: { isValid: true },
        syntaxValidation: { isValid: true, errors: [] },
        oneInitialSpfRecord: { isValid: true },
        maxTenSpfRecords: { isValid: true },
        deprecatedMechanisms: { isValid: true, errors: [] },
        unsafeAllMechanism: { isValid: true, errors: [] },
        firstAllQualifier: { qualifier: '~' }
      };

      mockContext.req!.query = jest.fn().mockReturnValue('complex-spf.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockSpfService.getSpfRecord.mockResolvedValue(mockSpfRecords);
      mockValidator.validate.mockReturnValue(mockValidationResults);

      await controller(mockContext as Context);

      const response = (mockContext.json as jest.Mock).mock.calls[0][0];
      
      expect(response.spfRecords).toHaveLength(3);
      expect(response.spfRecords[0].type).toBe('initial');
      expect(response.spfRecords[1].type).toBe('include');
      expect(response.spfRecords[2].type).toBe('include');
    });

    it('should return 400 for missing domain parameter', async () => {
      mockContext.req!.query = jest.fn().mockReturnValue(undefined);
      mockContext.json = jest.fn().mockReturnValue(new Response());

      await controller(mockContext as Context);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: 'Domain parameter is required',
          requestId: 'test-spf-request-id-456'
        },
        400
      );
      expect(mockSpfService.getSpfRecord).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid domain format', async () => {
      mockContext.req!.query = jest.fn().mockReturnValue('invalid-domain');
      mockContext.json = jest.fn().mockReturnValue(new Response());

      await controller(mockContext as Context);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: 'Invalid domain format',
          field: 'domain',
          requestId: 'test-spf-request-id-456'
        },
        400
      );
      expect(mockSpfService.getSpfRecord).not.toHaveBeenCalled();
    });

    it('should sanitize domain input', async () => {
      const mockSpfRecords: SpfRecordObject[] = [MOCK_SPF_RECORDS.basic];
      const mockValidationResults: SpfValidationResults = {
        hasSpfRecord: { isValid: true },
        syntaxValidation: { isValid: true, errors: [] },
        oneInitialSpfRecord: { isValid: true },
        maxTenSpfRecords: { isValid: true },
        deprecatedMechanisms: { isValid: true, errors: [] },
        unsafeAllMechanism: { isValid: true, errors: [] },
        firstAllQualifier: { qualifier: '~' }
      };

      mockContext.req!.query = jest.fn().mockReturnValue('  EXAMPLE.COM  ');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockSpfService.getSpfRecord.mockResolvedValue(mockSpfRecords);
      mockValidator.validate.mockReturnValue(mockValidationResults);

      await controller(mockContext as Context);

      expect(mockSpfService.getSpfRecord).toHaveBeenCalledWith(
        'example.com', 
        new Set(), 
        'initial', 
        testConfig
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle SPF service errors', async () => {
      mockContext.req!.query = jest.fn().mockReturnValue('example.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockSpfService.getSpfRecord.mockRejectedValue(new Error('SPF service unavailable'));

      await controller(mockContext as Context);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: 'SPF service unavailable',
          requestId: 'test-spf-request-id-456',
          responseTime: expect.any(Number),
          timestamp: expect.any(String)
        },
        500
      );
    });

    it('should handle validation errors', async () => {
      mockContext.req!.query = jest.fn().mockReturnValue('');
      mockContext.json = jest.fn().mockReturnValue(new Response());

      await controller(mockContext as Context);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: 'Domain parameter is required',
          requestId: 'test-spf-request-id-456'
        },
        400
      );
    });

    it('should return appropriate error responses', async () => {
      mockContext.req!.query = jest.fn().mockReturnValue('example.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockSpfService.getSpfRecord.mockRejectedValue(new Error('DNS TXT query failed'));

      await controller(mockContext as Context);

      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'DNS TXT query failed',
          requestId: 'test-spf-request-id-456',
          responseTime: expect.any(Number),
          timestamp: expect.any(String)
        }),
        500
      );
    });

    it('should handle timeout errors with 504 status', async () => {
      mockContext.req!.query = jest.fn().mockReturnValue('example.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockSpfService.getSpfRecord.mockRejectedValue(new Error('SPF query timeout'));

      await controller(mockContext as Context);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: 'SPF query timeout',
          requestId: 'test-spf-request-id-456',
          responseTime: expect.any(Number),
          timestamp: expect.any(String)
        },
        504
      );
    });

    it('should handle unknown errors gracefully', async () => {
      mockContext.req!.query = jest.fn().mockReturnValue('example.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockSpfService.getSpfRecord.mockRejectedValue('string error');

      await controller(mockContext as Context);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: 'An unknown error occurred',
          requestId: 'test-spf-request-id-456',
          responseTime: expect.any(Number),
          timestamp: expect.any(String)
        },
        500
      );
    });
  });

  describe('Response Format', () => {
    it('should include all required response fields', async () => {
      const mockSpfRecords: SpfRecordObject[] = [MOCK_SPF_RECORDS.basic];
      const mockValidationResults: SpfValidationResults = {
        hasSpfRecord: { isValid: true },
        syntaxValidation: { isValid: true, errors: [] },
        oneInitialSpfRecord: { isValid: true },
        maxTenSpfRecords: { isValid: true },
        deprecatedMechanisms: { isValid: true, errors: [] },
        unsafeAllMechanism: { isValid: true, errors: [] },
        firstAllQualifier: { qualifier: '~' }
      };

      mockContext.req!.query = jest.fn().mockReturnValue('example.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockSpfService.getSpfRecord.mockResolvedValue(mockSpfRecords);
      mockValidator.validate.mockReturnValue(mockValidationResults);

      await controller(mockContext as Context);

      const response = (mockContext.json as jest.Mock).mock.calls[0][0];
      
      // Check all required fields are present
      expect(response).toHaveProperty('domain');
      expect(response).toHaveProperty('spfRecords');
      expect(response).toHaveProperty('validationResults');
      expect(response).toHaveProperty('requestId');
      expect(response).toHaveProperty('responseTime');
      expect(response).toHaveProperty('timestamp');
      
      // Check field types
      expect(typeof response.domain).toBe('string');
      expect(Array.isArray(response.spfRecords)).toBe(true);
      expect(typeof response.validationResults).toBe('object');
      expect(typeof response.requestId).toBe('string');
      expect(typeof response.responseTime).toBe('number');
      expect(typeof response.timestamp).toBe('string');
    });

    it('should format validation results correctly', async () => {
      const mockSpfRecords: SpfRecordObject[] = [MOCK_SPF_RECORDS.basic];
      const mockValidationResults: SpfValidationResults = {
        hasSpfRecord: { isValid: true },
        syntaxValidation: { isValid: true, errors: [] },
        oneInitialSpfRecord: { isValid: true },
        maxTenSpfRecords: { isValid: true },
        deprecatedMechanisms: { isValid: true, errors: [] },
        unsafeAllMechanism: { isValid: true, errors: [] },
        firstAllQualifier: { qualifier: '~' }
      };

      mockContext.req!.query = jest.fn().mockReturnValue('example.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockSpfService.getSpfRecord.mockResolvedValue(mockSpfRecords);
      mockValidator.validate.mockReturnValue(mockValidationResults);

      await controller(mockContext as Context);

      const response = (mockContext.json as jest.Mock).mock.calls[0][0];
      const validationResults = response.validationResults;
      
      // Check structure of validation results
      expect(validationResults.hasSpfRecord).toHaveProperty('isValid');
      expect(validationResults.syntaxValidation).toHaveProperty('isValid');
      expect(validationResults.syntaxValidation).toHaveProperty('errors');
      expect(validationResults.oneInitialSpfRecord).toHaveProperty('isValid');
      expect(validationResults.maxTenSpfRecords).toHaveProperty('isValid');
      expect(validationResults.deprecatedMechanisms).toHaveProperty('isValid');
      expect(validationResults.deprecatedMechanisms).toHaveProperty('errors');
      expect(validationResults.unsafeAllMechanism).toHaveProperty('isValid');
      expect(validationResults.unsafeAllMechanism).toHaveProperty('errors');
      expect(validationResults.firstAllQualifier).toHaveProperty('qualifier');
    });

    it('should include performance metrics', async () => {
      const mockSpfRecords: SpfRecordObject[] = [MOCK_SPF_RECORDS.basic];
      const mockValidationResults: SpfValidationResults = {
        hasSpfRecord: { isValid: true },
        syntaxValidation: { isValid: true, errors: [] },
        oneInitialSpfRecord: { isValid: true },
        maxTenSpfRecords: { isValid: true },
        deprecatedMechanisms: { isValid: true, errors: [] },
        unsafeAllMechanism: { isValid: true, errors: [] },
        firstAllQualifier: { qualifier: '~' }
      };

      mockContext.req!.query = jest.fn().mockReturnValue('example.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockSpfService.getSpfRecord.mockResolvedValue(mockSpfRecords);
      mockValidator.validate.mockReturnValue(mockValidationResults);

      const startTime = Date.now();
      await controller(mockContext as Context);
      const endTime = Date.now();

      const response = (mockContext.json as jest.Mock).mock.calls[0][0];
      
      expect(response.responseTime).toBeGreaterThanOrEqual(0);
      expect(response.responseTime).toBeLessThanOrEqual(endTime - startTime + 10); // Allow small buffer
      expect(response.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO timestamp format
    });
  });

  describe('Logging', () => {
    it('should log request start and completion', async () => {
      const loggerInfoSpy = jest.spyOn(console, 'info');
      
      const mockSpfRecords: SpfRecordObject[] = [MOCK_SPF_RECORDS.basic];
      const mockValidationResults: SpfValidationResults = {
        hasSpfRecord: { isValid: true },
        syntaxValidation: { isValid: true, errors: [] },
        oneInitialSpfRecord: { isValid: true },
        maxTenSpfRecords: { isValid: true },
        deprecatedMechanisms: { isValid: true, errors: [] },
        unsafeAllMechanism: { isValid: true, errors: [] },
        firstAllQualifier: { qualifier: '~' }
      };

      mockContext.req!.query = jest.fn().mockReturnValue('example.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockSpfService.getSpfRecord.mockResolvedValue(mockSpfRecords);
      mockValidator.validate.mockReturnValue(mockValidationResults);

      await controller(mockContext as Context);

      // Check that logging occurred
      expect(loggerInfoSpy).toHaveBeenCalled();
    });

    it('should log errors with appropriate context', async () => {
      const loggerErrorSpy = jest.spyOn(console, 'error');
      
      mockContext.req!.query = jest.fn().mockReturnValue('example.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockSpfService.getSpfRecord.mockRejectedValue(new Error('SPF service error'));

      await controller(mockContext as Context);

      // Check that error logging occurred
      expect(loggerErrorSpy).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty SPF record arrays gracefully', async () => {
      const mockSpfRecords: SpfRecordObject[] = [];
      const mockValidationResults: SpfValidationResults = {
        hasSpfRecord: { isValid: false, message: 'No SPF record found' },
        syntaxValidation: { isValid: false, errors: [] },
        oneInitialSpfRecord: { isValid: false },
        maxTenSpfRecords: { isValid: false },
        deprecatedMechanisms: { isValid: false, errors: [] },
        unsafeAllMechanism: { isValid: false, errors: [] },
        firstAllQualifier: { qualifier: null }
      };

      mockContext.req!.query = jest.fn().mockReturnValue('example.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockSpfService.getSpfRecord.mockResolvedValue(mockSpfRecords);
      mockValidator.validate.mockReturnValue(mockValidationResults);

      await controller(mockContext as Context);

      const response = (mockContext.json as jest.Mock).mock.calls[0][0];
      
      expect(response.spfRecords).toHaveLength(0);
      expect(response.validationResults.hasSpfRecord.isValid).toBe(false);
    });

    it('should handle validator throwing errors', async () => {
      const mockSpfRecords: SpfRecordObject[] = [MOCK_SPF_RECORDS.basic];

      mockContext.req!.query = jest.fn().mockReturnValue('example.com');
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockSpfService.getSpfRecord.mockResolvedValue(mockSpfRecords);
      mockValidator.validate.mockImplementation(() => {
        throw new Error('Validator error');
      });

      await controller(mockContext as Context);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: 'Validator error',
          requestId: 'test-spf-request-id-456',
          responseTime: expect.any(Number),
          timestamp: expect.any(String)
        },
        500
      );
    });

    it('should handle missing User-Agent header', async () => {
      const mockSpfRecords: SpfRecordObject[] = [MOCK_SPF_RECORDS.basic];
      const mockValidationResults: SpfValidationResults = {
        hasSpfRecord: { isValid: true },
        syntaxValidation: { isValid: true, errors: [] },
        oneInitialSpfRecord: { isValid: true },
        maxTenSpfRecords: { isValid: true },
        deprecatedMechanisms: { isValid: true, errors: [] },
        unsafeAllMechanism: { isValid: true, errors: [] },
        firstAllQualifier: { qualifier: '~' }
      };

      mockContext.req!.query = jest.fn().mockReturnValue('example.com');
      mockContext.req!.header = jest.fn().mockReturnValue(undefined);
      mockContext.json = jest.fn().mockReturnValue(new Response());
      mockSpfService.getSpfRecord.mockResolvedValue(mockSpfRecords);
      mockValidator.validate.mockReturnValue(mockValidationResults);

      await controller(mockContext as Context);

      // Should still work without User-Agent
      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: 'example.com',
          spfRecords: mockSpfRecords
        })
      );
    });
  });
});