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
  validA: { 
    Status: 0, 
    Answer: [{ name: 'example.com', type: 1, TTL: 300, data: '93.184.216.34' }] 
  },
  validTXT: {
    Status: 0,
    Answer: [{ name: 'example.com', type: 16, TTL: 300, data: '"v=spf1 include:_spf.google.com ~all"' }]
  },
  multipleSpf: {
    Status: 0,
    Answer: [
      { name: 'example.com', type: 16, TTL: 300, data: '"v=spf1 ip4:192.168.1.0/24 ~all"' },
      { name: 'example.com', type: 16, TTL: 300, data: '"v=spf1 include:backup.example.com ~all"' }
    ]
  },
  nxDomain: { Status: 3, Answer: [] },
  serverFail: { Status: 2, Answer: [] },
  refused: { Status: 5, Answer: [] },
  noData: { Status: 0, Answer: [] }
};

export const MOCK_SPF_RECORDS = {
  basic: {
    domain: 'example.com',
    spfRecord: 'v=spf1 ip4:192.168.1.0/24 ~all',
    type: 'initial' as const
  },
  withInclude: {
    domain: 'example.com',
    spfRecord: 'v=spf1 include:_spf.google.com ~all',
    type: 'initial' as const
  },
  withRedirect: {
    domain: 'example.com',
    spfRecord: 'v=spf1 redirect=spf.example.com',
    type: 'initial' as const
  },
  included: {
    domain: '_spf.google.com',
    spfRecord: 'v=spf1 ip4:209.85.128.0/17 ip4:64.233.160.0/19 ~all',
    type: 'include' as const
  },
  invalid: {
    domain: 'example.com',
    spfRecord: 'invalid spf record',
    type: 'initial' as const
  },
  unsafeAll: {
    domain: 'example.com',
    spfRecord: 'v=spf1 +all',
    type: 'initial' as const
  },
  deprecated: {
    domain: 'example.com',
    spfRecord: 'v=spf1 ptr ~all',
    type: 'initial' as const
  }
};

export const TEST_CONFIG = {
  dns: {
    dohUrls: ["https://test-dns.com/dns-query"],
    timeout: 5000,
    retries: 2
  },
  spf: {
    maxLookups: 10,
    maxRecordLength: 255,
    maxRecords: 1
  },
  dkim: {
    commonSelectors: ['selector1', 'selector2', 'google', 'default']
  },
  server: {
    port: 8787,
    cors: {
      enabled: true,
      origins: ['*']
    }
  },
  logging: {
    level: 'debug' as const,
    enableRequestLogging: true
  }
};

export const DKIM_TEST_DATA = {
    validRecords: {
        // 2048-bit key
        google: 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAv+7VkodWnuVKYRoJXVjUUXIDNw/Ks7Scu6PSrfJT4V9/zfrIm7VhFnvGDr6rQKXQUqK6vVXkKlGuL/K7bYZYYD0ZHvU1dNuT9pnYN3Kh/1j0q9JIFqqgD9gEE+8FW5YyABgIZnXAGa4/TZ7NE0Es6TRwXTePNtgZxqhPde2Mj0m9GQPEHRVVUhb7oP3WSIF3Om7cFxPNwYPHgVY5P9TuZ7VJf3yU6RSEYqjnV+fVPxRxUXwuHh3Z3N6lKiFDQvmOJe5dT88TEXEQ+AcgM4m/VDVaXYKxIQfDHHEzGIbxG6SIaR7+FGcrKn4C5/6Gm/WjvXS2ZssTCrF5Aq0QuQIDAQAB; t=y:s; n=test notes',
        // 1024-bit key
        default: 'v=DKIM1; a=rsa-sha256; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDEHBQbCXDZgUP9nht0TGQTXYtEFoCHtJZQVxXgSQsSf9zPnZQH9ykzXt9jqVUxMMOj9JXiBXQH7F0Z6JYwNWkY8NkHV4Nt/JJwgtBHX8x6JwPF7j8F5SrV0q8HrKjhkEeGtXh3yDtPVEZhD0d0/xVQ4HK5YrDkDtqXHgBvhwIDAQAB',
        // 2048-bit key
        selector1: 'v=DKIM1; a=rsa-sha256; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0Gd3s8HJj6SqhvEnDjx0Yx1NvqEHtS0CDkqZHUpDJ7A9NIOYxgIgPyeHZ5FSKcXPfyVX5BDXeKDPIR0H4RD4LJcPPw3zUNGFDXF5ZRv6L1nwLkC1R2qUhZQ0QMakK0HjYwsBYGVl4X2CdQ/7Y8zV0Z8VyKQNHm6CxsJ9qKxsAQ3M+GGo+mEz/DMDzaUx+0PzqMFeTYBZJ8KJ/Jr9TSaSsB+dKgTJTQX+hOgWjh6D8N/F2Q3G1B3ZiEBe2o8qYn6aKkBJ8+1qGVUCj7PZJQEHUYrVzxRWbKzNM1yGF9xHxF3RWiHyymj0DrC/BxXyaU1P7S/N5YC4MoVp4Zz9JwIDAQAB; s=email',
        // 2048-bit key
        selector2: 'v=DKIM1; a=rsa-sha256; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAiJXr+4xZLFhN8jNcvO5LfWbvE8mKely4Fz5fJ5YsJW/v8F7GhLcGnT/0ekVwkUqoXn2QOA5wEDRPBG4E6g+8d2K7G5MDn+YQ8vh3Yvjg7ZuYYP0E8FlEE/Yn+IjGMGWEBJ3wPQXr+6v1SGtqDxjHoJoR6+eVz3jvX4CyuEbQK4WkT8KGr6HH5hqjLPgBWIXtk6F/NS0/uN+PGWkFk2qBOO47TD+Y5WGLQV+qZKqXMwHbJeUFv1F5dx+7fpwXHh6EIEXxlYA/DjBe3i9HYXr7Pn7Rh0g4Bm/Uaj+1E5pCmE+eWe9bCnGBZ2IVpRB6UZUJhQI+XVWJjJCOUDXZVQIDAQAB'
    },
    invalidRecords: {
        missingVersion: 'k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAv+7VkodWnuVKYRoJXVjUUXIDNw/Ks7Scu6PSrfJT4V9/zfrIm7VhFnvGDr6rQKXQUqK6vVXkKlGuL/K7bYZYYD0ZHvU1dNuT9pnYN3Kh/1j0q9JIFqq',
        invalidVersion: 'v=DKIM2; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAv+7VkodWnuVKYRoJXVjUUXIDNw/Ks7Scu6PSrfJT4V9/zfrIm7VhFnvGDr6rQKXQUqK6vVXkKlGuL/K7bYZYYD0ZHvU1dNuT9pnYN3Kh/1j0q9JIFqq',
        missingPublicKey: 'v=DKIM1; k=rsa;',
        invalidAlgorithm: 'v=DKIM1; a=invalid; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAv+7VkodWnuVKYRoJXVjUUXIDNw/Ks7Scu6PSrfJT4V9/zfrIm7VhFnvGDr6rQKXQUqK6vVXkKlGuL/K7bYZYYD0ZHvU1dNuT9pnYN3Kh/1j0q9JIFqq',
        malformed: 'v=DKIM1; k=rsa; p=not_a_valid_key'
    },
    testDomains: {
        valid: 'example.com',
        withMultipleRecords: 'multi.example.com',
        withNoRecords: 'no-dkim.example.com',
        withInvalidRecords: 'invalid.example.com'
    }
};