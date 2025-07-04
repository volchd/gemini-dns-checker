import { DomainValidator, ValidationError, QueryValidator } from '../../src/utils/validation';

describe('DomainValidator', () => {
  describe('validate', () => {
    it('should accept valid domains', () => {
      const validDomains = [
        'example.com',
        'sub.example.com',
        'example.co.uk',
        'test-domain.com',
        'domain123.com'
      ];

      validDomains.forEach(domain => {
        expect(() => DomainValidator.validate(domain)).not.toThrow();
      });
    });

    it('should reject invalid domains', () => {
      const invalidDomains = [
        '',
        '   ',
        'invalid',
        '.example.com',
        'example.',
        'example..com',
        'example-.com',
        '-example.com',
        'example.com-',
        'example@.com',
        'example.com/',
        'example.com:',
        'example.com?',
        'example.com#',
        'example.com.',
        'a'.repeat(64) + '.com', // label too long
        'example.' + 'a'.repeat(64), // TLD too long
        'a'.repeat(254) + '.com', // total length too long
      ];

      invalidDomains.forEach(domain => {
        try {
          DomainValidator.validate(domain);
          console.log(`Domain "${domain}" was not rejected but should have been`);
        } catch (error) {
          // Expected to throw
        }
        expect(() => DomainValidator.validate(domain)).toThrow(ValidationError);
      });
    });

    it('should reject reserved TLDs', () => {
      const reservedTLDs = [
        'example.localhost',
        'test.example',
        'invalid.test',
        'corp.local',
        'home.lan'
      ];

      reservedTLDs.forEach(domain => {
        expect(() => DomainValidator.validate(domain)).toThrow(ValidationError);
      });
    });

    it('should throw ValidationError with field information', () => {
      try {
        DomainValidator.validate('');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).field).toBe('domain');
        expect((error as ValidationError).message).toBe('Domain parameter is required');
      }
    });

    it('should handle non-string inputs', () => {
      expect(() => DomainValidator.validate(null as any)).toThrow(ValidationError);
      expect(() => DomainValidator.validate(undefined as any)).toThrow(ValidationError);
      expect(() => DomainValidator.validate(123 as any)).toThrow(ValidationError);
    });
  });

  describe('sanitize', () => {
    it('should trim whitespace and convert to lowercase', () => {
      expect(DomainValidator.sanitize('  EXAMPLE.COM  ')).toBe('example.com');
      expect(DomainValidator.sanitize('Example.Com')).toBe('example.com');
      expect(DomainValidator.sanitize('  Test.Domain.COM  ')).toBe('test.domain.com');
    });
  });
});

describe('QueryValidator', () => {
  describe('validateRequired', () => {
    it('should return value when field exists', () => {
      const query = { domain: 'example.com', other: 'value' };
      expect(QueryValidator.validateRequired(query, 'domain')).toBe('example.com');
    });

    it('should throw ValidationError when field is missing', () => {
      const query = { other: 'value' };
      expect(() => QueryValidator.validateRequired(query, 'domain')).toThrow(ValidationError);
    });

    it('should throw ValidationError when field is empty string', () => {
      const query = { domain: '' };
      expect(() => QueryValidator.validateRequired(query, 'domain')).toThrow(ValidationError);
    });

    it('should throw ValidationError when field is undefined', () => {
      const query = { domain: undefined };
      expect(() => QueryValidator.validateRequired(query, 'domain')).toThrow(ValidationError);
    });
  });

  describe('validateOptional', () => {
    it('should return value when field exists', () => {
      const query = { domain: 'example.com', other: 'value' };
      expect(QueryValidator.validateOptional(query, 'domain')).toBe('example.com');
    });

    it('should return undefined when field is missing', () => {
      const query = { other: 'value' };
      expect(QueryValidator.validateOptional(query, 'domain')).toBeUndefined();
    });

    it('should return empty string when field is empty string', () => {
      const query = { domain: '' };
      expect(QueryValidator.validateOptional(query, 'domain')).toBe('');
    });
  });
}); 