export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class DomainValidator {
  private static readonly DOMAIN_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;
  private static readonly MAX_DOMAIN_LENGTH = 253;
  private static readonly MAX_LABEL_LENGTH = 63;

  static validate(domain: string): void {
    if (!domain) {
      throw new ValidationError('Domain parameter is required', 'domain');
    }

    if (typeof domain !== 'string') {
      throw new ValidationError('Domain must be a string', 'domain');
    }

    const trimmedDomain = domain.trim().toLowerCase();
    
    if (trimmedDomain.length === 0) {
      throw new ValidationError('Domain cannot be empty', 'domain');
    }

    if (trimmedDomain.length > this.MAX_DOMAIN_LENGTH) {
      throw new ValidationError(`Domain length cannot exceed ${this.MAX_DOMAIN_LENGTH} characters`, 'domain');
    }

    if (!this.DOMAIN_REGEX.test(trimmedDomain)) {
      throw new ValidationError('Invalid domain format', 'domain');
    }

    // Check individual label lengths
    const labels = trimmedDomain.split('.');
    for (const label of labels) {
      if (label.length > this.MAX_LABEL_LENGTH) {
        throw new ValidationError(`Domain label cannot exceed ${this.MAX_LABEL_LENGTH} characters`, 'domain');
      }
    }

    // Check for reserved TLDs or invalid patterns
    if (this.isReservedTLD(trimmedDomain)) {
      throw new ValidationError('Domain uses a reserved TLD', 'domain');
    }
  }

  private static isReservedTLD(domain: string): boolean {
    const reservedTLDs = [
      'localhost', 'test', 'example', 'invalid', 'local',
      'internal', 'private', 'corp', 'home', 'lan'
    ];
    
    const tld = domain.split('.').pop()?.toLowerCase();
    return tld ? reservedTLDs.includes(tld) : false;
  }

  static sanitize(domain: string): string {
    return domain.trim().toLowerCase();
  }
}

export class QueryValidator {
  static validateRequired(query: Record<string, string | undefined>, field: string): string {
    const value = query[field];
    if (!value) {
      throw new ValidationError(`${field} parameter is required`, field);
    }
    return value;
  }

  static validateOptional(query: Record<string, string | undefined>, field: string): string | undefined {
    return query[field];
  }
} 