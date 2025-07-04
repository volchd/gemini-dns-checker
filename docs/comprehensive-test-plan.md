# Comprehensive Test Plan for Gemini DNS Checker

## Overview

This document outlines a comprehensive testing strategy for the Gemini DNS Checker, a Cloudflare Worker application that provides DNS registration checks and SPF record validation. The plan covers unit tests, integration tests, end-to-end tests, performance tests, and security tests.

## Current Test Coverage

### Existing Tests ✅
- **DNS Service Tests** (`tests/services/dns-service.test.ts`)
  - DNS registration checks
  - Retry logic
  - Error handling
  - Timeout handling
  
- **Validation Utility Tests** (`tests/utils/validation.test.ts`)
  - Domain validation
  - Input sanitization
  - Error cases

### Test Coverage Gaps ❌
- SPF Service and Validator tests
- Controller tests (API layer)
- Logger utility tests
- Configuration tests
- Integration tests
- End-to-end tests
- Performance tests
- Security tests

## Test Categories

### 1. Unit Tests

#### 1.1 Services

##### DNS Service (`src/services/dns-service.ts`) ✅ Partially Complete
**Existing Coverage:**
- Basic DNS registration checks
- Retry mechanism
- HTTP error handling
- Timeout scenarios

**Missing Coverage:**
- Edge cases for DNS responses (SERVFAIL, REFUSED, etc.)
- Different record types beyond A records
- Network interruption scenarios
- DNS response validation
- Performance metrics validation

**New Test Cases Needed:**
```typescript
// tests/services/dns-service.test.ts (additions)
describe('DNS Service - Extended', () => {
  describe('Edge Cases', () => {
    it('should handle SERVFAIL status code');
    it('should handle REFUSED status code');
    it('should handle malformed DNS responses');
    it('should handle extremely slow responses');
    it('should handle DNS responses with no answers but status 0');
  });

  describe('Record Types', () => {
    it('should query AAAA records');
    it('should query MX records');
    it('should query NS records');
    it('should query CNAME records');
  });

  describe('Performance', () => {
    it('should measure query time accurately');
    it('should handle concurrent requests');
  });
});
```

##### SPF Service (`src/services/spf-service.ts`) ❌ Missing
**Required Test Coverage:**
- Basic SPF record retrieval
- Recursive include handling
- Redirect mechanism handling
- Circular dependency detection
- Maximum recursion depth
- Error handling for invalid includes
- TXT record parsing edge cases

**New Test File:** `tests/services/spf-service.test.ts`
```typescript
describe('SPF Service', () => {
  describe('getSpfRecord', () => {
    it('should fetch basic SPF record');
    it('should handle multiple SPF records');
    it('should process include mechanisms recursively');
    it('should process redirect mechanisms');
    it('should detect and prevent circular dependencies');
    it('should handle non-existent included domains');
    it('should handle malformed include mechanisms');
    it('should respect visited domains set');
    it('should handle DNS query failures gracefully');
    it('should parse quoted TXT records correctly');
    it('should handle domains with no TXT records');
    it('should handle extremely long SPF chains');
  });
});
```

##### SPF Validator (`src/services/spf-validator.ts`) ❌ Missing
**Required Test Coverage:**
- Syntax validation for all SPF mechanisms
- Validation rule checking
- IPv4/IPv6 address validation
- Deprecated mechanism detection
- Unsafe "all" mechanism detection
- Record count validation
- Qualifier parsing

**New Test File:** `tests/services/spf-validator.test.ts`
```typescript
describe('SPF Validator', () => {
  describe('Syntax Validation', () => {
    it('should validate basic SPF record syntax');
    it('should reject records not starting with v=spf1');
    it('should validate all mechanism types (a, mx, ip4, ip6, include, exists, all)');
    it('should validate IPv4 addresses and CIDR notation');
    it('should validate IPv6 addresses and CIDR notation');
    it('should validate qualifiers (+, -, ~, ?)');
    it('should reject unknown mechanisms');
    it('should validate modifier syntax (redirect, exp)');
  });

  describe('Validation Rules', () => {
    it('should enforce single initial SPF record rule');
    it('should enforce maximum 10 lookups rule');
    it('should detect deprecated mechanisms (ptr)');
    it('should detect unsafe +all mechanisms');
    it('should extract first all qualifier correctly');
  });

  describe('Edge Cases', () => {
    it('should handle empty SPF record arrays');
    it('should handle malformed record objects');
    it('should handle extremely long SPF records');
    it('should handle records with multiple spaces');
    it('should handle case sensitivity correctly');
  });
});
```

#### 1.2 Controllers

##### DNS Controller (`src/controllers/dns-controller.ts`) ❌ Missing
**New Test File:** `tests/controllers/dns-controller.test.ts`
```typescript
describe('DNS Controller', () => {
  describe('Request Handling', () => {
    it('should handle valid domain requests');
    it('should return 400 for missing domain parameter');
    it('should return 400 for invalid domain format');
    it('should sanitize domain input');
    it('should include request metadata in response');
    it('should handle DNS service errors gracefully');
    it('should return appropriate status codes');
    it('should measure and return response times');
  });

  describe('Error Handling', () => {
    it('should handle validation errors');
    it('should handle DNS timeout errors with 504 status');
    it('should handle unexpected errors with 500 status');
    it('should include request ID in all responses');
  });

  describe('Logging', () => {
    it('should log request start and completion');
    it('should log errors with appropriate context');
    it('should include performance metrics in logs');
  });
});
```

##### SPF Controller (`src/controllers/spf-controller.ts`) ❌ Missing
**New Test File:** `tests/controllers/spf-controller.test.ts`
```typescript
describe('SPF Controller', () => {
  describe('Request Handling', () => {
    it('should handle valid SPF validation requests');
    it('should return complete SPF analysis');
    it('should include all validation results');
    it('should handle domains with no SPF records');
    it('should handle domains with complex SPF chains');
  });

  describe('Error Handling', () => {
    it('should handle SPF service errors');
    it('should handle validation errors');
    it('should return appropriate error responses');
  });

  describe('Response Format', () => {
    it('should include all required response fields');
    it('should format validation results correctly');
    it('should include performance metrics');
  });
});

#### 1.3 Utilities

##### Logger (`src/utils/logger.ts`) ❌ Missing
**New Test File:** `tests/utils/logger.test.ts`
```typescript
describe('Logger', () => {
  describe('Singleton Pattern', () => {
    it('should return same instance');
    it('should maintain state across calls');
  });

  describe('Log Levels', () => {
    it('should respect log level hierarchy');
    it('should filter messages below current level');
    it('should change log level dynamically');
  });

  describe('Message Formatting', () => {
    it('should format messages with timestamp');
    it('should include context in formatted message');
    it('should handle missing context gracefully');
    it('should format error messages with stack traces');
  });

  describe('Output', () => {
    it('should output to appropriate console methods');
    it('should not output when level is too low');
  });
});

##### Validation (`src/utils/validation.ts`) ✅ Well Covered
**Potential Additions:**
- Internationalized domain names (IDN)
- Punycode domain handling
- Additional edge cases for domain validation

#### 1.4 Configuration

##### Config (`src/config.ts`) ❌ Missing
**New Test File:** `tests/config.test.ts`
```typescript
describe('Configuration', () => {
  describe('Default Config', () => {
    it('should have valid default values');
    it('should include all required config sections');
  });

  describe('Environment Override', () => {
    it('should override DNS settings from environment');
    it('should override logging settings from environment');
    it('should handle invalid environment values gracefully');
    it('should preserve defaults for unset environment variables');
  });

  describe('Validation', () => {
    it('should validate timeout values');
    it('should validate retry counts');
    it('should validate log levels');
  });
});

### 2. Integration Tests

#### 2.1 Application Integration ❌ Missing
**New Test File:** `tests/integration/app.test.ts`
```typescript
describe('Application Integration', () => {
  describe('Health Check', () => {
    it('should return healthy status');
    it('should include version and endpoints');
  });

  describe('DNS Endpoint', () => {
    it('should perform end-to-end DNS check');
    it('should handle real domain queries');
    it('should handle non-existent domains');
  });

  describe('SPF Endpoint', () => {
    it('should perform end-to-end SPF validation');
    it('should handle real SPF record analysis');
    it('should handle complex SPF chains');
  });

  describe('Error Handling', () => {
    it('should handle 404 routes');
    it('should handle global errors');
    it('should maintain consistent error format');
  });

  describe('Middleware', () => {
    it('should apply CORS headers');
    it('should log requests');
    it('should handle OPTIONS requests');
  });
});

#### 2.2 Service Integration ❌ Missing
**New Test File:** `tests/integration/services.test.ts`
```typescript
describe('Service Integration', () => {
  describe('DNS + SPF Integration', () => {
    it('should validate domain before SPF check');
    it('should handle domains with both A and SPF records');
    it('should correlate DNS and SPF results');
  });

  describe('Configuration Integration', () => {
    it('should use config across all services');
    it('should apply timeouts consistently');
    it('should use consistent retry logic');
  });
});

### 3. End-to-End Tests

#### 3.1 Real Domain Testing ❌ Missing
**New Test File:** `tests/e2e/real-domains.test.ts`
```typescript
describe('Real Domain E2E Tests', () => {
  describe('Known Good Domains', () => {
    it('should correctly identify google.com as registered');
    it('should validate google.com SPF records');
    it('should handle microsoft.com SPF chain');
    it('should process github.com SPF includes');
  });

  describe('Known Bad Domains', () => {
    it('should identify non-existent domains');
    it('should handle domains without SPF records');
    it('should handle domains with invalid SPF syntax');
  });

  describe('Edge Case Domains', () => {
    it('should handle international domains');
    it('should handle very long domain names');
    it('should handle domains with complex SPF chains');
  });
});

#### 3.2 API Contract Testing ❌ Missing
**New Test File:** `tests/e2e/api-contracts.test.ts`
```typescript
describe('API Contract Tests', () => {
  describe('Response Schemas', () => {
    it('should match DNS response schema');
    it('should match SPF response schema');
    it('should match error response schema');
  });

  describe('Status Codes', () => {
    it('should return correct status codes for all scenarios');
    it('should handle malformed requests appropriately');
  });

  describe('Headers', () => {
    it('should include required CORS headers');
    it('should include content-type headers');
  });
});

### 4. Performance Tests

#### 4.1 Load Testing ❌ Missing
**New Test File:** `tests/performance/load.test.ts`
```typescript
describe('Performance Tests', () => {
  describe('DNS Service Performance', () => {
    it('should handle 100 concurrent DNS requests');
    it('should complete DNS queries within SLA');
    it('should maintain performance under load');
  });

  describe('SPF Service Performance', () => {
    it('should handle complex SPF chains efficiently');
    it('should cache results appropriately');
    it('should prevent excessive recursion');
  });

  describe('Memory Usage', () => {
    it('should not leak memory during long runs');
    it('should handle large SPF chains without excessive memory');
  });
});

#### 4.2 Benchmark Testing ❌ Missing
**New Test File:** `tests/performance/benchmarks.test.ts`
```typescript
describe('Benchmark Tests', () => {
  describe('Response Time Benchmarks', () => {
    it('should complete DNS checks under 2 seconds');
    it('should complete SPF validation under 5 seconds');
    it('should handle simple queries under 500ms');
  });

  describe('Throughput Benchmarks', () => {
    it('should handle minimum 50 requests per second');
    it('should maintain response quality under load');
  });
});

### 5. Security Tests

#### 5.1 Input Validation Security ❌ Missing
**New Test File:** `tests/security/input-validation.test.ts`
```typescript
describe('Security Tests', () => {
  describe('Input Sanitization', () => {
    it('should prevent DNS injection attacks');
    it('should handle malicious domain inputs');
    it('should prevent command injection through domain parameter');
    it('should handle extremely long inputs');
  });

  describe('DoS Protection', () => {
    it('should timeout long-running DNS queries');
    it('should limit SPF recursion depth');
    it('should handle malformed DNS responses');
  });

  describe('Data Exposure', () => {
    it('should not expose sensitive information in errors');
    it('should not leak internal implementation details');
    it('should handle PII in domain names appropriately');
  });
});

#### 5.2 Rate Limiting ❌ Missing
**New Test File:** `tests/security/rate-limiting.test.ts`
```typescript
describe('Rate Limiting Security', () => {
  describe('Request Rate Limits', () => {
    it('should handle excessive requests gracefully');
    it('should not crash under rapid fire requests');
  });

  describe('Resource Protection', () => {
    it('should prevent DNS query exhaustion');
    it('should limit concurrent requests appropriately');
  });
});

### 6. Error Handling Tests

#### 6.1 Comprehensive Error Scenarios ❌ Missing
**New Test File:** `tests/error-handling/error-scenarios.test.ts`
```typescript
describe('Error Handling', () => {
  describe('Network Errors', () => {
    it('should handle DNS server unreachable');
    it('should handle network timeouts');
    it('should handle intermittent connectivity');
  });

  describe('Service Errors', () => {
    it('should handle DNS service unavailable');
    it('should handle malformed DNS responses');
    it('should handle rate limiting from DNS provider');
  });

  describe('Application Errors', () => {
    it('should handle configuration errors');
    it('should handle memory exhaustion gracefully');
    it('should handle unexpected exceptions');
  });
});

## Test Environment Setup

### Test Data Management
```typescript
// tests/fixtures/test-data.ts
export const TEST_DOMAINS = {
  valid: ['example.com', 'google.com', 'github.com'],
  invalid: ['invalid-domain', '...', 'test.localhost'],
  nonExistent: ['this-domain-should-never-exist-12345.com'],
  withSpf: ['google.com', 'github.com'],
  withoutSpf: ['example-no-spf.com'],
  complexSpf: ['google.com', '_spf.google.com'],
  circularSpf: ['circular-test-domain.com']
};

export const MOCK_DNS_RESPONSES = {
  validA: { Status: 0, Answer: [{ name: 'example.com', type: 1, TTL: 300, data: '93.184.216.34' }] },
  nxDomain: { Status: 3, Answer: [] },
  serverFail: { Status: 2, Answer: [] }
};
```

### Mock Strategies
```typescript
// tests/mocks/dns-mock.ts
export class DnsMock {
  static mockSuccessfulResponse(domain: string, recordType: string = 'A') { ... }
  static mockNxDomain(domain: string) { ... }
  static mockTimeout() { ... }
  static mockServerError() { ... }
}
```

## Test Execution Strategy

### Development Testing
```bash
# Unit tests during development
npm run test:watch

# Quick validation
npm run test:unit

# Coverage check
npm run test:coverage
```

### CI/CD Pipeline Testing
```bash
# Full test suite
npm run test:ci

# Performance benchmarks
npm run test:performance

# Security tests
npm run test:security

# E2E tests with real domains
npm run test:e2e
```

### Test Categories for CI
1. **Fast Tests** (< 30 seconds): Unit tests, mocked integration tests
2. **Medium Tests** (30s - 2min): Integration tests with external dependencies
3. **Slow Tests** (> 2 minutes): E2E tests, performance tests, security tests

## Implementation Priority

### Phase 1: Critical Missing Tests (Week 1)
1. SPF Service tests
2. SPF Validator tests
3. Controller tests
4. Logger tests

### Phase 2: Integration & E2E (Week 2)
1. Application integration tests
2. Service integration tests
3. Basic E2E tests with known domains

### Phase 3: Performance & Security (Week 3)
1. Performance benchmarks
2. Security tests
3. Load testing
4. Error scenario testing

### Phase 4: Advanced Testing (Week 4)
1. Real domain E2E tests
2. API contract tests
3. Extended error handling
4. Documentation and test maintenance

## Success Metrics

- **Unit Test Coverage**: > 90%
- **Integration Test Coverage**: > 80%
- **E2E Test Coverage**: Key user journeys covered
- **Performance**: All endpoints < 5s response time
- **Security**: No critical vulnerabilities
- **Reliability**: All tests passing consistently

## Tools and Libraries

### Testing Framework
- **Jest**: Primary testing framework
- **ts-jest**: TypeScript support
- **@types/jest**: TypeScript definitions

### Additional Testing Libraries
```bash
npm install --save-dev supertest  # HTTP assertion library
npm install --save-dev nock      # HTTP request mocking
npm install --save-dev faker     # Test data generation
npm install --save-dev jest-performance-testing  # Performance testing
```

### Performance Testing
```bash
npm install --save-dev autocannon  # Load testing
npm install --save-dev clinic      # Performance profiling
```

## Continuous Improvement

1. **Regular Test Review**: Weekly review of test failures and coverage
2. **Performance Monitoring**: Track test execution time and optimize slow tests
3. **Test Maintenance**: Keep tests updated with code changes
4. **Coverage Goals**: Maintain >90% code coverage
5. **Quality Gates**: Block deployments if critical tests fail

## Conclusion

This comprehensive test plan ensures robust testing across all layers of the Gemini DNS Checker application. The phased implementation approach allows for incremental improvement while addressing the most critical testing gaps first. Regular monitoring and maintenance of the test suite will ensure long-term reliability and maintainability of the application.