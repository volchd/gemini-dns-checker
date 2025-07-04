import { getSpfRecord } from '../services/spf-service';
import { SpfValidator } from '../services/spf-validator';
import { Context } from 'hono';
import { SpfValidationResults } from '../types';
import { DomainValidator, ValidationError } from '../utils/validation';
import { logger } from '../utils/logger';
import { AppConfig } from '../config';

/**
 * Creates an SPF validation handler with the provided configuration.
 * @param config The application configuration.
 * @returns A function that handles SPF validation requests.
 */
export function createSpfController(config: AppConfig) {
  return async function handleSpfRequest(c: Context): Promise<Response> {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  logger.info(`SPF validation request received`, { 
    requestId, 
    endpoint: '/spf',
    userAgent: c.req.header('User-Agent') 
  });

  try {
    // Extract and validate the domain parameter
    const domain = c.req.query('domain');
    
    if (!domain) {
      logger.warn(`SPF request missing domain parameter`, { requestId });
      return c.json({ 
        error: 'Domain parameter is required',
        requestId 
      }, 400);
    }

    // Validate and sanitize the domain
    try {
      DomainValidator.validate(domain);
    } catch (validationError) {
      const error = validationError as ValidationError;
      logger.warn(`SPF request with invalid domain`, { 
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
    
    logger.info(`Starting SPF validation`, { 
      requestId, 
      domain: sanitizedDomain 
    });

    // Fetch SPF records for the given domain using the spf-service
    const spfRecords = await getSpfRecord(sanitizedDomain, new Set(), 'initial', config);
    
    // Create an instance of SpfValidator and validate the fetched SPF records with scoring
    const spfValidator = new SpfValidator();
    const { validationResults, scoringResults } = spfValidator.validateWithScoring(spfRecords);
    
    const responseTime = Date.now() - startTime;
    
    logger.info(`SPF validation completed successfully`, { 
      requestId, 
      domain: sanitizedDomain,
      recordCount: spfRecords.length,
      score: scoringResults.totalScore,
      percentage: scoringResults.percentage,
      grade: scoringResults.grade,
      responseTime 
    });

    // Return the domain, SPF records, validation results, and scoring results as a JSON response
    return c.json({ 
      domain: sanitizedDomain, 
      spfRecords, 
      validationResults,
      scoringResults,
      requestId,
      responseTime,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    
    logger.error(`SPF validation failed`, error as Error, { 
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
