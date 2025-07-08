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
        google: 'v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC; t=y:s; n=test notes',
        default: 'v=DKIM1; a=rsa-sha256; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC',
        selector1: 'v=DKIM1; a=rsa-sha256; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC; s=email',
        selector2: 'v=DKIM1; a=rsa-sha256; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC'
    },
    invalidRecords: {
        missingVersion: 'k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC',
        invalidVersion: 'v=DKIM2; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC',
        missingPublicKey: 'v=DKIM1; k=rsa;',
        invalidAlgorithm: 'v=DKIM1; a=invalid; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC',
        malformed: 'v=DKIM1; k=rsa; p=invalid_key_data'
    },
    testDomains: {
        valid: 'example.com',
        withMultipleRecords: 'multi.example.com',
        withNoRecords: 'no-dkim.example.com',
        withInvalidRecords: 'invalid.example.com'
    }
};