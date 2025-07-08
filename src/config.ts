export interface AppConfig {
  dns: {
    dohUrls: string[];
    timeout: number;
    retries: number;
  };
  spf: {
    maxLookups: number;
    maxRecordLength: number;
    maxRecords: number;
  };
  dkim: {
    commonSelectors: string[];
  };
  server: {
    port: number;
    cors: {
      enabled: boolean;
      origins: string[];
    };
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    enableRequestLogging: boolean;
  };
}

const defaultConfig: AppConfig = {
  dns: {
    dohUrls: [
      "https://dns.google/resolve",
      "https://cloudflare-dns.com/dns-query",
      "https://unfiltered.adguard-dns.com/resolve"
    ],
    timeout: 10000, // 10 seconds
    retries: 3
  },
  spf: {
    maxLookups: 10,
    maxRecordLength: 255,
    maxRecords: 1
  },
  dkim: {
    commonSelectors: [
      // Microsoft 365
      'selector1',     // Primary Microsoft 365 selector
      'selector2',     // Secondary Microsoft 365 selector
      
      // Google Workspace
      'google',        // Primary Google Workspace selector
      
      // Generic/Common
      'default',       // Generic default selector
      'dkim',          // Common generic selector
      'mail',          // Common generic selector
      'k1',           // MailChimp/Mandrill selector
      'k2',           // MailChimp/Mandrill selector
      'k3',           // MailChimp/Mandrill selector
      'k4',           // MailChimp/Mandrill selector
      'k5',           // MailChimp/Mandrill selector
      'k6',           // MailChimp/Mandrill selector
      'k7',           // MailChimp/Mandrill selector
      'k8',           // MailChimp/Mandrill selector
      
      // Email Service Providers
      'everlytickey1', // Everlytic primary
      'everlytickey2', // Everlytic secondary
      'eversrv',       // Everlytic legacy
      'mxvault',       // Global Micro
      'pm',           // ProtonMail
      's1',           // Common secondary selector
      's2',           // Common secondary selector
      'smtp',         // Common SMTP selector
      
      // Amazon SES
      'amazonses',     // Amazon SES default
      
      // SendGrid
      'smtpapi',      // SendGrid
      's1024',        // SendGrid legacy
      
      // Zoho
      'zoho',         // Zoho Mail
      
      // Other Common Services
      'mailjet',      // Mailjet
      'postmark',     // Postmark
      'sendinblue',   // Sendinblue/Brevo
      'qualtrics',    // Qualtrics
      'mandrill',     // Mandrill
      'mailchimp',    // Mailchimp
      'mailgun',      // Mailgun
      'sparkpost',    // Sparkpost
      'sendgrid',     // Sendgrid
      'sendinblue',   // Sendinblue/Brevo
      'sendinblue',   // Sendinblue/Brevo
      
      // Zendesk
      'zendesk',      // Zendesk
      'zendesk1', // Zendesk
      'zendesk2', // Zendesk
      'zohomail',     // Zoho Mail
      'zohomail',     // Zoho Mail

      // Date-based (for custom implementations)
      'current',      // Current selector
      'previous',     // Previous selector
      'rotate',       // Rotation selector
    ]
  },
  server: {
    port: 8787,
    cors: {
      enabled: true,
      origins: ['*']
    }
  },
  logging: {
    level: 'info',
    enableRequestLogging: true
  }
};

export function getConfig(env?: Record<string, string>): AppConfig {
  // In Cloudflare Workers, environment variables are passed via the env parameter
  
  // Parse DoH URLs from environment variable
  let dohUrls = defaultConfig.dns.dohUrls;
  if (env?.DOH_URLS) {
    dohUrls = env.DOH_URLS.split(',').map(url => url.trim()).filter(url => url.length > 0);
  } else if (env?.DOH_URL) {
    // Backward compatibility: single DoH URL
    dohUrls = [env.DOH_URL];
  }
  
  // Ensure we have at least one DoH URL
  if (dohUrls.length === 0) {
    dohUrls = defaultConfig.dns.dohUrls;
  }

  return {
    ...defaultConfig,
    dns: {
      ...defaultConfig.dns,
      dohUrls,
      timeout: parseInt(env?.DNS_TIMEOUT || defaultConfig.dns.timeout.toString()),
      retries: parseInt(env?.DNS_RETRIES || defaultConfig.dns.retries.toString())
    },
    logging: {
      ...defaultConfig.logging,
      level: (env?.LOG_LEVEL as any) || defaultConfig.logging.level
    }
  };
}

export const config = getConfig();

// Legacy export for backward compatibility
export const dohUrl = config.dns.dohUrls[0];
