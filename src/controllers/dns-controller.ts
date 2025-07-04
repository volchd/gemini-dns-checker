import { Context } from "hono";
import { checkDnsRegistration } from "../services/dns-service";
import { DomainValidator, ValidationError } from "../utils/validation";
import { logger } from "../utils/logger";
import { AppConfig } from "../config";

/**
 * Creates a DNS check handler with the provided configuration.
 * @param config The application configuration.
 * @returns A function that handles DNS check requests.
 */
export function createDnsController(config: AppConfig) {
  return async function checkDns(c: Context): Promise<Response> {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();
    
    logger.info(`DNS check request received`, { 
      requestId, 
      endpoint: '/checkDNS',
      userAgent: c.req.header('User-Agent') 
    });

    try {
      // Extract and validate the domain parameter
      const domain = c.req.query("domain");
      
      if (!domain) {
        logger.warn(`DNS check request missing domain parameter`, { requestId });
        return c.json({ 
          error: "Domain parameter is required",
          requestId 
        }, 400);
      }

      // Validate and sanitize the domain
      try {
        DomainValidator.validate(domain);
      } catch (validationError) {
        const error = validationError as ValidationError;
        logger.warn(`DNS check request with invalid domain`, { 
          requestId, 
          domain, 
          error: error.message 
        });
        return c.json({ 
          error: error.message,
          field: error.field,
          requestId 
        }, 400);
      }

      const sanitizedDomain = DomainValidator.sanitize(domain);
      
      logger.info(`Starting DNS registration check`, { 
        requestId, 
        domain: sanitizedDomain 
      });

      // Perform the DNS check
      const result = await checkDnsRegistration(sanitizedDomain, config);
      
      const responseTime = Date.now() - startTime;
      
      logger.info(`DNS check completed successfully`, { 
        requestId, 
        domain: sanitizedDomain,
        isRegistered: result.isRegistered,
        responseTime 
      });

      // Return the result with additional metadata
      return c.json({
        ...result,
        requestId,
        responseTime,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      
      logger.error(`DNS check failed`, error as Error, { 
        requestId, 
        responseTime 
      });

      // Return appropriate error response
      const statusCode = error instanceof Error && error.message.includes('timeout') ? 504 : 500;
      
      return c.json({ 
        error: errorMessage,
        requestId,
        responseTime,
        timestamp: new Date().toISOString()
      }, statusCode);
    }
  };
}
