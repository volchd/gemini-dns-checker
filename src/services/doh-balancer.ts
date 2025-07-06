import { AppConfig } from "../config";
import { logger } from "../utils/logger";

/**
 * Selects a random DoH URL from the configured list.
 * @param config Configuration object containing the list of DoH URLs.
 * @returns A randomly selected DoH URL.
 * @throws Error if no DoH URLs are configured.
 */
export function getRandomDohUrl(config: AppConfig): string {
  const { dohUrls } = config.dns;
  
  if (!dohUrls || dohUrls.length === 0) {
    logger.error('No DoH URLs configured');
    throw new Error('No DoH URLs configured');
  }
  
  // Select a random URL from the list
  const randomIndex = Math.floor(Math.random() * dohUrls.length);
  const selectedUrl = dohUrls[randomIndex];
  
  logger.debug(`Selected DoH URL: ${selectedUrl}`, { 
    selectedUrl, 
    totalUrls: dohUrls.length,
    allUrls: dohUrls 
  });
  
  return selectedUrl;
}

/**
 * Returns all configured DoH URLs.
 * @param config Configuration object containing the list of DoH URLs.
 * @returns Array of all configured DoH URLs.
 */
export function getAllDohUrls(config: AppConfig): string[] {
  return [...config.dns.dohUrls];
}

/**
 * Validates that all configured DoH URLs are valid HTTPS URLs.
 * @param config Configuration object containing the list of DoH URLs.
 * @returns True if all URLs are valid, false otherwise.
 */
export function validateDohUrls(config: AppConfig): boolean {
  const { dohUrls } = config.dns;
  
  if (!dohUrls || dohUrls.length === 0) {
    return false;
  }
  
  return dohUrls.every(url => {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  });
} 