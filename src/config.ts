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
