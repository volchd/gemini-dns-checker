export interface AppConfig {
  dns: {
    dohUrl: string;
    timeout: number;
    retries: number;
  };
  spf: {
    maxLookups: number;
    maxRecordLength: number;
    maxRecords: number;
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
    dohUrl: "https://cloudflare-dns.com/dns-query",
    timeout: 10000, // 10 seconds
    retries: 3
  },
  spf: {
    maxLookups: 10,
    maxRecordLength: 255,
    maxRecords: 1
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
  return {
    ...defaultConfig,
    dns: {
      ...defaultConfig.dns,
      dohUrl: env?.DOH_URL || defaultConfig.dns.dohUrl,
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
export const dohUrl = config.dns.dohUrl;
