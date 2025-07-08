# Gemini DNS Checker

A Cloudflare Worker application for DNS, SPF, and DKIM record validation with comprehensive error handling, logging, and testing.

## Features

- **DNS Registration Check**: Verify if domains are registered and accessible
- **SPF Record Validation**: Comprehensive SPF record analysis and validation with scoring
- **DKIM Record Validation**: DKIM record retrieval, parsing, and validation
- **DNS-over-HTTPS (DoH) Load Balancing**: Automatic load balancing across multiple DoH providers
- **Robust Error Handling**: Retry logic, timeout handling, and detailed error reporting
- **Structured Logging**: Centralized logging with different levels and context
- **Input Validation**: Comprehensive domain validation and sanitization
- **CORS Support**: Cross-origin resource sharing enabled
- **Health Checks**: Built-in health check endpoint
- **Comprehensive Testing**: Unit tests with Jest and TypeScript

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Cloudflare account with Workers enabled

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The application will be available at `http://localhost:8787`

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests for CI
npm run test:ci
```

### Deployment

```bash
npm run deploy
```

## API Endpoints

### Health Check
```
GET /
```
Returns application status and available endpoints.

### DNS Check
```
GET /api/dns?domain=example.com
GET /api/dns/txt?domain=example.com
```
Checks if a domain is registered and accessible, or retrieves TXT records.

**Response:**
```json
{
  "domain": "example.com",
  "isRegistered": true,
  "dnsResponse": { ... },
  "queryTime": 150,
  "requestId": "uuid",
  "responseTime": 200,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### SPF Validation
```
GET /api/spf?domain=example.com
GET /api/spf/score?domain=example.com
```
Validates SPF records for a domain and provides a scoring analysis.

**Response:**
```json
{
  "domain": "example.com",
  "spfRecords": [ ... ],
  "validationResults": {
    "hasSpfRecord": { "isValid": true },
    "syntaxValidation": { "isValid": true, "errors": [] },
    "oneInitialSpfRecord": { "isValid": true },
    "maxTenSpfRecords": { "isValid": true },
    "deprecatedMechanisms": { "isValid": true, "errors": [] },
    "unsafeAllMechanism": { "isValid": true, "errors": [] },
    "firstAllQualifier": { "qualifier": "~" }
  },
  "score": {
    "totalScore": 35,
    "maxPossibleScore": 37,
    "percentage": 95,
    "grade": "A",
    "scoreItems": [ ... ]
  },
  "requestId": "uuid",
  "responseTime": 300,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### DKIM Validation
```
GET /api/dkim?domain=example.com
GET /api/dkim/record?domain=example.com&selector=default
GET /api/dkim/validate?domain=example.com
GET /api/dkim/selectors?domain=example.com
```
DKIM record management and validation endpoints.

**Response for /api/dkim?domain=example.com:**
```json
{
  "domain": "example.com",
  "records": [
    {
      "domain": "example.com",
      "selector": "default",
      "rawRecord": "v=DKIM1; k=rsa; p=...",
      "parsedData": {
        "version": "DKIM1",
        "algorithm": "rsa-sha256",
        "keyType": "rsa",
        "publicKey": "...",
        "serviceType": "email",
        "flags": [],
        "notes": ""
      },
      "retrievedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "retrievedAt": "2024-01-01T00:00:00.000Z",
  "score": {
    "totalScore": 20,
    "maxPossibleScore": 20,
    "percentage": 100,
    "scoreItems": [
      {
        "name": "DKIM Implemented",
        "description": "At least one DKIM public key record is published for the domain.",
        "score": 10,
        "maxScore": 10,
        "passed": true,
        "details": "Found 1 DKIM record(s)"
      },
      {
        "name": "DKIM Key Length",
        "description": "Strength of DKIM keys in DNS: 2048-bit (or higher): 5 points. 1024-bit: 3 points. <1024-bit: 0.",
        "score": 5,
        "maxScore": 5,
        "passed": true,
        "details": "default: 2048 bits"
      },
      {
        "name": "DKIM Multiple Selectors",
        "description": "Domain has at least two DKIM selectors/keys set up (facilitates key rotation).",
        "score": 0,
        "maxScore": 3,
        "passed": false,
        "details": "Only one selector found"
      },
      {
        "name": "No DKIM Test Mode",
        "description": "DKIM DNS records are in normal mode (no t=y flags set, indicating no lingering test-mode).",
        "score": 2,
        "maxScore": 2,
        "passed": true,
        "details": "No test mode flags found"
      }
    ]
  },
  "requestId": "uuid",
  "responseTime": 250,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

- The `score` object provides a detailed breakdown of DKIM configuration quality, including key length, selector count, and test mode status.
- Scoring is based on best practices for DKIM security and compliance.

**Response for /api/dkim/validate:**
```json
{
  "domain": "example.com",
  "records": [
    {
      "selector": "default",
      "isValid": true,
      "checks": {
        "hasValidSelector": true,
        "hasValidVersion": true,
        "hasValidAlgorithm": true,
        "hasValidPublicKey": true,
        "hasValidSyntax": true
      },
      "issues": []
    }
  ],
  "isValid": true,
  "domainIssues": [],
  "requestId": "uuid",
  "responseTime": 250,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### DoH Provider Management
```
GET /api/doh?domain=example.com
GET /api/doh/urls
```
DNS-over-HTTPS query and provider management endpoints.

**Response for /api/doh/urls:**
```json
{
  "providers": [
    {
      "name": "Cloudflare",
      "url": "https://cloudflare-dns.com/dns-query"
    },
    {
      "name": "Google",
      "url": "https://dns.google/dns-query"
    }
  ]
}
```

## Configuration

The application can be configured through environment variables:

- `DOH_URLS`: Comma-separated list of DNS over HTTPS provider URLs
- `DOH_URL`: Default DNS over HTTPS provider URL (default: Cloudflare)
- `DNS_TIMEOUT`: DNS query timeout in milliseconds (default: 10000)
- `DNS_RETRIES`: Number of DNS query retries (default: 3)
- `LOG_LEVEL`: Logging level (debug, info, warn, error) (default: info)

## Project Structure

```
src/
├── config.ts              # Application configuration
├── index.ts              # Main application entry point
├── types.ts              # TypeScript type definitions
├── controllers/          # Request handlers
│   ├── dkim-controller.ts
│   ├── dns-controller.ts
│   ├── doh-controller.ts
│   └── spf-controller.ts
├── services/            # Business logic
│   ├── dkim-service.ts
│   ├── dns-service.ts
│   ├── doh-balancer.ts
│   ├── spf-scorer.ts
│   ├── spf-service.ts
│   └── spf-validator.ts
└── utils/               # Utility functions
    ├── logger.ts
    └── validation.ts
```

## Development

### Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Type checking
npm run type-check

# Build
npm run build
```

### Pre-deployment Checks

The `predeploy` script automatically runs:
- All tests with coverage
- Type checking
- Linting

## Error Handling

The application includes comprehensive error handling:

- **Validation Errors**: 400 Bad Request with field-specific messages
- **DNS Timeouts**: 504 Gateway Timeout
- **Server Errors**: 500 Internal Server Error
- **Not Found**: 404 with available endpoints

All errors include:
- Request ID for tracking
- Response time
- Timestamp
- Descriptive error message

## Logging

Structured logging with different levels:
- **DEBUG**: Detailed debugging information
- **INFO**: General application flow
- **WARN**: Warning conditions
- **ERROR**: Error conditions with stack traces

Logs include context such as:
- Request ID
- Domain being processed
- Response times
- Error details

## Testing

The test suite includes:
- Unit tests for all services
- Validation logic tests
- Error handling tests
- Mock DNS responses
- DKIM validation tests
- SPF scoring tests
- DoH load balancer tests

Run tests with coverage to ensure code quality:
```bash
npm run test:coverage
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see LICENSE file for details.
