import { SpfValidator } from '../../src/services/spf-validator';
import { SpfRecordObject } from '../../src/types';
import { MOCK_SPF_RECORDS } from '../fixtures/test-data';

describe('SPF Validator', () => {
  let spfValidator: SpfValidator;

  beforeEach(() => {
    spfValidator = new SpfValidator();
    // Suppress console.log for cleaner test output
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Syntax Validation', () => {
    it('should validate basic SPF record syntax', () => {
      const records = [MOCK_SPF_RECORDS.basic];
      const result = spfValidator.validate(records);
      
      expect(result.syntaxValidation.isValid).toBe(true);
      expect(result.syntaxValidation.errors).toHaveLength(0);
    });

    it('should reject records not starting with v=spf1', () => {
      const records: SpfRecordObject[] = [{
        domain: 'example.com',
        spfRecord: 'ip4:192.168.1.0/24 ~all',
        type: 'initial'
      }];
      
      const result = spfValidator.validate(records);
      
      expect(result.syntaxValidation.isValid).toBe(false);
      expect(result.syntaxValidation.errors[0].error).toContain('must start with "v=spf1"');
    });

    it('should validate all mechanism types (a, mx, ip4, ip6, include, exists, all)', () => {
      const records: SpfRecordObject[] = [{
        domain: 'example.com',
        spfRecord: 'v=spf1 a mx ip4:192.168.1.0/24 ip6:2001:db8::/32 include:_spf.example.com exists:test.example.com ~all',
        type: 'initial'
      }];
      
      const result = spfValidator.validate(records);
      
      expect(result.syntaxValidation.isValid).toBe(true);
    });

    it('should validate IPv4 addresses and CIDR notation', () => {
      const validRecords: SpfRecordObject[] = [{
        domain: 'example.com',
        spfRecord: 'v=spf1 ip4:192.168.1.1 ip4:192.168.1.0/24 ~all',
        type: 'initial'
      }];
      
      const result = spfValidator.validate(validRecords);
      expect(result.syntaxValidation.isValid).toBe(true);

      const invalidRecords: SpfRecordObject[] = [{
        domain: 'example.com',
        spfRecord: 'v=spf1 ip4:999.999.999.999 ~all',
        type: 'initial'
      }];
      
      const invalidResult = spfValidator.validate(invalidRecords);
      expect(invalidResult.syntaxValidation.isValid).toBe(false);
      expect(invalidResult.syntaxValidation.errors[0].error).toContain('Invalid IPv4 address');
    });

    it('should validate IPv6 addresses and CIDR notation', () => {
      const validRecords: SpfRecordObject[] = [{
        domain: 'example.com',
        spfRecord: 'v=spf1 ip6:2001:db8::1 ip6:2001:db8::/32 ~all',
        type: 'initial'
      }];
      
      const result = spfValidator.validate(validRecords);
      expect(result.syntaxValidation.isValid).toBe(true);

      const invalidRecords: SpfRecordObject[] = [{
        domain: 'example.com',
        spfRecord: 'v=spf1 ip6:invalid::address ~all',
        type: 'initial'
      }];
      
      const invalidResult = spfValidator.validate(invalidRecords);
      expect(invalidResult.syntaxValidation.isValid).toBe(false);
      expect(invalidResult.syntaxValidation.errors[0].error).toContain('Invalid IPv6 address');
    });

    it('should validate qualifiers (+, -, ~, ?)', () => {
      const records: SpfRecordObject[] = [{
        domain: 'example.com',
        spfRecord: 'v=spf1 +a -mx ~ip4:192.168.1.0/24 ?include:test.com ~all',
        type: 'initial'
      }];
      
      const result = spfValidator.validate(records);
      
      expect(result.syntaxValidation.isValid).toBe(true);
    });

    it('should reject unknown mechanisms', () => {
      const records: SpfRecordObject[] = [{
        domain: 'example.com',
        spfRecord: 'v=spf1 unknown:value ~all',
        type: 'initial'
      }];
      
      const result = spfValidator.validate(records);
      
      expect(result.syntaxValidation.isValid).toBe(false);
      expect(result.syntaxValidation.errors[0].error).toContain('Unknown mechanism');
    });

    it('should validate modifier syntax (redirect, exp)', () => {
      const redirectRecord: SpfRecordObject[] = [{
        domain: 'example.com',
        spfRecord: 'v=spf1 redirect=spf.example.com',
        type: 'initial'
      }];
      
      const redirectResult = spfValidator.validate(redirectRecord);
      expect(redirectResult.syntaxValidation.isValid).toBe(true);

      const expRecord: SpfRecordObject[] = [{
        domain: 'example.com',
        spfRecord: 'v=spf1 ip4:192.168.1.0/24 exp=explain.example.com ~all',
        type: 'initial'
      }];
      
      const expResult = spfValidator.validate(expRecord);
      expect(expResult.syntaxValidation.isValid).toBe(true);
    });

    it('should require values for mechanisms that need them', () => {
      const records: SpfRecordObject[] = [{
        domain: 'example.com',
        spfRecord: 'v=spf1 include ~all',
        type: 'initial'
      }];
      
      const result = spfValidator.validate(records);
      
      expect(result.syntaxValidation.isValid).toBe(false);
      expect(result.syntaxValidation.errors[0].error).toContain('requires a value');
    });
  });

  describe('Validation Rules', () => {
    it('should enforce single initial SPF record rule', () => {
      const multipleInitialRecords: SpfRecordObject[] = [
        { domain: 'example.com', spfRecord: 'v=spf1 ip4:192.168.1.0/24 ~all', type: 'initial' },
        { domain: 'example.com', spfRecord: 'v=spf1 ip4:10.0.0.0/8 ~all', type: 'initial' }
      ];
      
      const result = spfValidator.validate(multipleInitialRecords);
      
      expect(result.oneInitialSpfRecord.isValid).toBe(false);
      expect(result.oneInitialSpfRecord.message).toContain('exactly one initial SPF record');
    });

    it('should enforce maximum 10 lookups rule', () => {
      const manyIncludeRecords: SpfRecordObject[] = [
        { domain: 'example.com', spfRecord: 'v=spf1 include:_spf1.example.com ~all', type: 'initial' }
      ];
      
      // Add 11 include records to exceed the limit
      for (let i = 1; i <= 11; i++) {
        manyIncludeRecords.push({
          domain: `_spf${i}.example.com`,
          spfRecord: 'v=spf1 ip4:192.168.1.0/24 ~all',
          type: 'include'
        });
      }
      
      const result = spfValidator.validate(manyIncludeRecords);
      
      expect(result.maxTenSpfRecords.isValid).toBe(false);
      expect(result.maxTenSpfRecords.message).toContain('should not exceed 10');
    });

    it('should detect deprecated mechanisms (ptr)', () => {
      const records = [MOCK_SPF_RECORDS.deprecated];
      
      const result = spfValidator.validate(records);
      
      expect(result.deprecatedMechanisms.isValid).toBe(false);
      expect(result.deprecatedMechanisms.errors[0].error).toContain('Deprecated mechanism found: "ptr"');
    });

    it('should detect unsafe +all mechanisms', () => {
      const records = [MOCK_SPF_RECORDS.unsafeAll];
      
      const result = spfValidator.validate(records);
      
      expect(result.unsafeAllMechanism.isValid).toBe(false);
      expect(result.unsafeAllMechanism.errors[0].error).toContain('Unsafe "+all"');
    });

    it('should extract first all qualifier correctly', () => {
      const softFailRecord: SpfRecordObject[] = [{
        domain: 'example.com',
        spfRecord: 'v=spf1 ip4:192.168.1.0/24 ~all',
        type: 'initial'
      }];
      
      const result = spfValidator.validate(softFailRecord);
      
      expect(result.firstAllQualifier.qualifier).toBe('~');
    });

    it('should return + qualifier for bare all mechanism', () => {
      const bareAllRecord: SpfRecordObject[] = [{
        domain: 'example.com',
        spfRecord: 'v=spf1 ip4:192.168.1.0/24 all',
        type: 'initial'
      }];
      
      const result = spfValidator.validate(bareAllRecord);
      
      expect(result.firstAllQualifier.qualifier).toBe('+');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty SPF record arrays', () => {
      const result = spfValidator.validate([]);
      
      expect(result.hasSpfRecord.isValid).toBe(false);
      expect(result.hasSpfRecord.message).toBe('No SPF record found.');
    });

    it('should handle malformed record objects', () => {
      const malformedRecords: SpfRecordObject[] = [{
        domain: 'example.com',
        spfRecord: '',
        type: 'initial'
      }];
      
      const result = spfValidator.validate(malformedRecords);
      
      expect(result.syntaxValidation.isValid).toBe(false);
    });

    it('should handle extremely long SPF records', () => {
      const longRecord: SpfRecordObject[] = [{
        domain: 'example.com',
        spfRecord: 'v=spf1 ' + 'ip4:192.168.1.0/24 '.repeat(50) + '~all',
        type: 'initial'
      }];
      
      const result = spfValidator.validate(longRecord);
      
      expect(result.syntaxValidation.isValid).toBe(true);
    });

    it('should handle records with multiple spaces', () => {
      const spacedRecord: SpfRecordObject[] = [{
        domain: 'example.com',
        spfRecord: 'v=spf1    ip4:192.168.1.0/24     ~all',
        type: 'initial'
      }];
      
      const result = spfValidator.validate(spacedRecord);
      
      expect(result.syntaxValidation.isValid).toBe(true);
    });

    it('should handle case sensitivity correctly', () => {
      const upperCaseRecord: SpfRecordObject[] = [{
        domain: 'example.com',
        spfRecord: 'V=SPF1 IP4:192.168.1.0/24 ~ALL',
        type: 'initial'
      }];
      
      const result = spfValidator.validate(upperCaseRecord);
      
      expect(result.syntaxValidation.isValid).toBe(false);
      expect(result.syntaxValidation.errors[0].error).toContain('must start with "v=spf1"');
    });

    it('should handle split SPF records with quotes', () => {
      const splitRecord: SpfRecordObject[] = [{
        domain: 'example.com',
        spfRecord: '"v=spf1 ip4:192.168.1.0/24" "include:_spf.google.com" "~all"',
        type: 'initial'
      }];
      
      const result = spfValidator.validate(splitRecord);
      
      expect(result.syntaxValidation.isValid).toBe(true);
    });
  });

  describe('hasSpfRecord', () => {
    it('should return true when SPF records exist', () => {
      const records = [MOCK_SPF_RECORDS.basic];
      const result = spfValidator.hasSpfRecord(records);
      
      expect(result).toBe(true);
    });

    it('should return false when no SPF records exist', () => {
      const result = spfValidator.hasSpfRecord([]);
      
      expect(result).toBe(false);
    });
  });

  describe('validateSpfSyntax', () => {
    it('should return no errors for valid SPF records', () => {
      const records = [MOCK_SPF_RECORDS.basic];
      const errors = spfValidator.validateSpfSyntax(records);
      
      expect(errors).toHaveLength(0);
    });

    it('should return errors for invalid SPF records', () => {
      const records = [MOCK_SPF_RECORDS.invalid];
      const errors = spfValidator.validateSpfSyntax(records);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].record).toBe(MOCK_SPF_RECORDS.invalid);
    });
  });

  describe('hasOneInitialSpfRecord', () => {
    it('should return true for exactly one initial record', () => {
      const records = [MOCK_SPF_RECORDS.basic];
      const result = spfValidator.hasOneInitialSpfRecord(records);
      
      expect(result).toBe(true);
    });

    it('should return false for multiple initial records', () => {
      const records = [
        MOCK_SPF_RECORDS.basic,
        { ...MOCK_SPF_RECORDS.basic, spfRecord: 'v=spf1 ip4:10.0.0.0/8 ~all' }
      ];
      const result = spfValidator.hasOneInitialSpfRecord(records);
      
      expect(result).toBe(false);
    });

    it('should return false for no initial records', () => {
      const records = [MOCK_SPF_RECORDS.included];
      const result = spfValidator.hasOneInitialSpfRecord(records);
      
      expect(result).toBe(false);
    });
  });

  describe('hasMaxTenSpfRecords', () => {
    it('should return true for 10 or fewer non-initial records', () => {
      const records = [
        MOCK_SPF_RECORDS.basic,
        ...Array(10).fill(0).map((_, i) => ({
          domain: `include${i}.example.com`,
          spfRecord: 'v=spf1 ip4:192.168.1.0/24 ~all',
          type: 'include' as const
        }))
      ];
      
      const result = spfValidator.hasMaxTenSpfRecords(records);
      
      expect(result).toBe(true);
    });

    it('should return false for more than 10 non-initial records', () => {
      const records = [
        MOCK_SPF_RECORDS.basic,
        ...Array(11).fill(0).map((_, i) => ({
          domain: `include${i}.example.com`,
          spfRecord: 'v=spf1 ip4:192.168.1.0/24 ~all',
          type: 'include' as const
        }))
      ];
      
      const result = spfValidator.hasMaxTenSpfRecords(records);
      
      expect(result).toBe(false);
    });
  });
});