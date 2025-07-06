import { Context } from "hono";
import { AppConfig } from "../config";
import { getRandomDohUrl, getAllDohUrls, validateDohUrls } from "../services/doh-balancer";
import { logger } from "../utils/logger";

export interface CloudflareBindings {
  // Add any Cloudflare-specific bindings here if needed
}

/**
 * Creates a DoH controller with the provided configuration.
 * @param config Application configuration object.
 * @returns A function that handles DoH-related HTTP requests.
 */
export function createDohController(config: AppConfig) {
  return async (c: Context<{ Bindings: CloudflareBindings }>) => {
    try {
      // Validate DoH URLs configuration
      if (!validateDohUrls(config)) {
        logger.error('Invalid DoH URLs configuration');
        return c.json({
          error: 'Invalid DoH URLs configuration',
          timestamp: new Date().toISOString()
        }, 500);
      }

      // Get a random DoH URL
      const randomUrl = getRandomDohUrl(config);
      
      logger.info('DoH URL requested', { 
        selectedUrl: randomUrl,
        totalUrls: config.dns.dohUrls.length 
      });

      return c.json({
        url: randomUrl,
        totalProviders: config.dns.dohUrls.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error getting DoH URL', error as Error);
      
      return c.json({
        error: 'Failed to get DoH URL',
        message: errorMessage,
        timestamp: new Date().toISOString()
      }, 500);
    }
  };
}

/**
 * Creates a DoH controller that returns all configured DoH URLs.
 * @param config Application configuration object.
 * @returns A function that handles requests for all DoH URLs.
 */
export function createDohListController(config: AppConfig) {
  return async (c: Context<{ Bindings: CloudflareBindings }>) => {
    try {
      // Validate DoH URLs configuration
      if (!validateDohUrls(config)) {
        logger.error('Invalid DoH URLs configuration');
        return c.json({
          error: 'Invalid DoH URLs configuration',
          timestamp: new Date().toISOString()
        }, 500);
      }

      const allUrls = getAllDohUrls(config);
      
      logger.info('All DoH URLs requested', { 
        totalUrls: allUrls.length 
      });

      return c.json({
        urls: allUrls,
        totalProviders: allUrls.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error getting DoH URLs', error as Error);
      
      return c.json({
        error: 'Failed to get DoH URLs',
        message: errorMessage,
        timestamp: new Date().toISOString()
      }, 500);
    }
  };
} 