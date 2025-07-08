# DKIM Service Implementation Plan

## Overview
The DKIM (DomainKeys Identified Mail) service will be responsible for retrieving and validating DKIM records for given domains. This service will integrate with our existing DNS infrastructure while following the project's TypeScript and Cloudflare Workers standards.

## Implementation Steps

### 1. Core Service Implementation
- Create new `dkim-service.ts` in `src/services/`
- Implement main service class with TypeScript interfaces
- Core functions:
  - `getDkimRecords(domain: string)`: Retrieve all DKIM records for domain
  - `getDkimRecord(domain: string, selector: string)`: Retrieve specific DKIM record
  - `validateDkimRecords(domain: string)`: Validate all records for domain
  - `discoverSelectors(domain: string)`: Discover available DKIM selectors
  - `parseDkimRecord(record: string)`: Parse DKIM record into structured data

### 2. Types and Interfaces
Add to `src/types.ts`:
- `DkimRecord` interface for individual records
- `DkimRecordSet` interface for domain-wide records collection
- `DkimValidationResult` interface for multi-record validation
- `DkimError` types
- `IDkimService` interface

Detailed Type Structures:
```typescript
interface DkimRecord {
    domain: string;
    selector: string;
    rawRecord: string;
    parsedData: {
        version: string;          // v=DKIM1
        algorithm: string;        // a=rsa-sha256
        keyType: string;         // k=rsa
        publicKey: string;       // p=base64encoded...
        serviceType?: string;    // s=email (optional)
        flags?: string[];       // t=y|s|... (optional)
        notes?: string;         // n=notes (optional)
    };
    retrievedAt: Date;
}

interface DkimRecordSet {
    domain: string;
    records: DkimRecord[];
    retrievedAt: Date;
}

interface DkimValidationResult {
    domain: string;
    isValid: boolean;
    records: Array<{
        selector: string;
        isValid: boolean;
        checks: {
            hasValidSelector: boolean;
            hasValidVersion: boolean;
            hasValidAlgorithm: boolean;
            hasValidPublicKey: boolean;
            hasValidSyntax: boolean;
        };
        issues: DkimValidationIssue[];
    }>;
    domainIssues: DkimValidationIssue[];
}
```

### 3. Controller Implementation
- Create `dkim-controller.ts` in `src/controllers/`
- Implement REST endpoints:
  - GET `/api/dkim/:domain` - Get all DKIM records
  - GET `/api/dkim/:domain/:selector` - Get specific DKIM record
  - GET `/api/dkim/:domain/validate` - Validate all records
  - GET `/api/dkim/:domain/selectors` - Discover selectors

### 4. Integration with Existing Services
- Integrate with `dns-service.ts` for DNS lookups
- Utilize `doh-balancer.ts` for DNS-over-HTTPS queries
- Implement proper error handling and logging
- Add caching layer for selector discovery results

### 5. Testing Suite
Create in `tests/`:
- `services/dkim-service.test.ts`
  - Test multi-record retrieval
  - Test selector discovery
  - Test record parsing
  - Test validation scenarios
- `controllers/dkim-controller.test.ts`
- Add DKIM fixtures in `tests/fixtures/`
  - Multiple selector scenarios
  - Various DKIM record formats
  - Invalid record cases
- Mock DNS responses for DKIM records

### 6. Documentation
- Update API documentation
- Add JSDoc comments
- Update README.md with DKIM functionality
- Document error codes and responses
- Add examples for multiple selector scenarios

## Technical Specifications

### DKIM Record Format
- Location: `selector._domainkey.domain.com`
- Record Type: TXT
- Format validation according to RFC 6376
- Common selector patterns:
  - google._domainkey (Google Workspace)
  - default._domainkey (Generic)
  - selector1._domainkey (Microsoft 365)
  - selector2._domainkey (Microsoft 365)

### Selector Discovery Strategy
1. Check common selector patterns
2. Parallel DNS queries for efficiency
3. Cache discovery results
4. Handle timeouts gracefully
5. Support custom selector hints

### Error Handling
- DNS resolution errors
- Invalid selector format
- Missing DKIM records
- Malformed DKIM records
- Timeout handling
- Partial failure handling for multi-record operations

### Security Considerations
- Input validation for domain and selector
- Rate limiting for API endpoints
- Response size limits
- Error message sanitization
- Handle oversized DKIM records

## Dependencies
- Existing DNS service
- DoH balancer
- Validation utilities
- Logger service

## Testing Strategy
- Unit tests for record parsing
- Integration tests for DNS lookups
- Error case coverage
- Performance testing
- Mock external dependencies
- Test multiple selector scenarios
- Test concurrent record fetching

## Deployment Plan
1. Implement core service
2. Add controller layer
3. Write comprehensive tests
4. Review security measures
5. Stage deployment
6. Production rollout

## Success Criteria
- 90%+ test coverage
- All TypeScript strict checks pass
- Performance within Worker CPU limits
- Proper error handling
- Comprehensive documentation
- Security review completed
- Successful multi-record handling
- Efficient selector discovery

## Future Enhancements
- DKIM key rotation monitoring
- Multiple selector support
- DKIM record suggestions
- Integration with SPF validation
- Historical record tracking
- Selector discovery optimization
- Record change monitoring
- DKIM policy recommendations 