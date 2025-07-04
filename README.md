# Gemini DNS Checker

A Cloudflare Worker application for DNS and SPF record validation with comprehensive error handling, logging, and testing.

## Features

- **DNS Registration Check**: Verify if domains are registered and accessible
- **SPF Record Validation**: Comprehensive SPF record analysis and validation
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
GET /checkDNS?domain=example.com
```
Checks if a domain is registered and accessible.

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
GET /spf?domain=example.com
```
Validates SPF records for a domain.

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
  "requestId": "uuid",
  "responseTime": 300,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Configuration

The application can be configured through environment variables:

- `DOH_URL`: DNS over HTTPS provider URL (default: Cloudflare)
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
│   ├── dns-controller.ts
│   └── spf-controller.ts
├── services/             # Business logic
│   ├── dns-service.ts
│   ├── spf-service.ts
│   └── spf-validator.ts
└── utils/                # Utility functions
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
