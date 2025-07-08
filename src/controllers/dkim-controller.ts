import { Context } from "hono";
import { IDkimService } from "../types";
import { DomainValidator, ValidationError } from "../utils/validation";
import { logger } from "../utils/logger";

export class DkimController {
    constructor(private dkimService: IDkimService) {}

    async getDkimRecords(c: Context): Promise<Response> {
        const startTime = Date.now();
        const requestId = crypto.randomUUID();
        
        logger.info(`DKIM records request received`, { 
            requestId, 
            endpoint: '/dkim',
            userAgent: c.req.header('User-Agent') 
        });

        try {
            const domain = c.req.query('domain');
            
            if (!domain) {
                logger.warn(`DKIM request missing domain parameter`, { requestId });
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
                logger.warn(`DKIM request with invalid domain`, { 
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
            
            logger.info(`Starting DKIM records fetch`, { 
                requestId, 
                domain: sanitizedDomain 
            });

            const records = await this.dkimService.getDkimRecords(sanitizedDomain);
            
            const responseTime = Date.now() - startTime;
            
            logger.info(`DKIM records fetch completed successfully`, { 
                requestId, 
                domain: sanitizedDomain,
                recordCount: records.records.length,
                responseTime 
            });

            return c.json({
                ...records,
                requestId,
                responseTime,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            const responseTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            
            logger.error(`DKIM records fetch failed`, error as Error, { 
                requestId, 
                responseTime 
            });

            const statusCode = error instanceof Error && error.message.includes('timeout') ? 504 : 500;
            
            return c.json({ 
                error: errorMessage,
                requestId,
                responseTime,
                timestamp: new Date().toISOString()
            }, statusCode);
        }
    }

    async getDkimRecord(c: Context): Promise<Response> {
        const startTime = Date.now();
        const requestId = crypto.randomUUID();
        
        logger.info(`DKIM record request received`, { 
            requestId, 
            endpoint: '/dkim',
            userAgent: c.req.header('User-Agent') 
        });

        try {
            const domain = c.req.query('domain');
            const selector = c.req.query('selector');
            
            if (!domain || !selector) {
                logger.warn(`DKIM request missing required parameters`, { requestId });
                return c.json({ 
                    error: "Domain and selector parameters are required",
                    requestId 
                }, 400);
            }

            // Validate and sanitize the domain
            try {
                DomainValidator.validate(domain);
            } catch (validationError) {
                const error = validationError as ValidationError;
                logger.warn(`DKIM request with invalid domain`, { 
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
            
            logger.info(`Starting DKIM record fetch`, { 
                requestId, 
                domain: sanitizedDomain,
                selector 
            });

            const record = await this.dkimService.getDkimRecord(sanitizedDomain, selector);
            
            const responseTime = Date.now() - startTime;
            
            logger.info(`DKIM record fetch completed successfully`, { 
                requestId, 
                domain: sanitizedDomain,
                selector,
                responseTime 
            });

            return c.json({
                ...record,
                requestId,
                responseTime,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            const responseTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            
            logger.error(`DKIM record fetch failed`, error as Error, { 
                requestId, 
                responseTime 
            });

            const statusCode = error instanceof Error && error.message.includes('timeout') ? 504 : 500;
            
            return c.json({ 
                error: errorMessage,
                requestId,
                responseTime,
                timestamp: new Date().toISOString()
            }, statusCode);
        }
    }

    async validateDkimRecords(c: Context): Promise<Response> {
        const startTime = Date.now();
        const requestId = crypto.randomUUID();
        
        logger.info(`DKIM validation request received`, { 
            requestId, 
            endpoint: '/dkim/validate',
            userAgent: c.req.header('User-Agent') 
        });

        try {
            const domain = c.req.query('domain');
            
            if (!domain) {
                logger.warn(`DKIM validation request missing domain parameter`, { requestId });
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
                logger.warn(`DKIM validation request with invalid domain`, { 
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
            
            logger.info(`Starting DKIM validation`, { 
                requestId, 
                domain: sanitizedDomain 
            });

            const validationResult = await this.dkimService.validateDkimRecords(sanitizedDomain);
            
            const responseTime = Date.now() - startTime;
            
            logger.info(`DKIM validation completed successfully`, { 
                requestId, 
                domain: sanitizedDomain,
                isValid: validationResult.isValid,
                recordCount: validationResult.records.length,
                responseTime 
            });

            return c.json({
                ...validationResult,
                requestId,
                responseTime,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            const responseTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            
            logger.error(`DKIM validation failed`, error as Error, { 
                requestId, 
                responseTime 
            });

            const statusCode = error instanceof Error && error.message.includes('timeout') ? 504 : 500;
            
            return c.json({ 
                error: errorMessage,
                requestId,
                responseTime,
                timestamp: new Date().toISOString()
            }, statusCode);
        }
    }

    async discoverSelectors(c: Context): Promise<Response> {
        const startTime = Date.now();
        const requestId = crypto.randomUUID();
        
        logger.info(`DKIM selector discovery request received`, { 
            requestId, 
            endpoint: '/dkim/selectors',
            userAgent: c.req.header('User-Agent') 
        });

        try {
            const domain = c.req.query('domain');
            
            if (!domain) {
                logger.warn(`DKIM selector discovery request missing domain parameter`, { requestId });
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
                logger.warn(`DKIM selector discovery request with invalid domain`, { 
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
            
            logger.info(`Starting DKIM selector discovery`, { 
                requestId, 
                domain: sanitizedDomain 
            });

            const selectors = await this.dkimService.discoverSelectors(sanitizedDomain);
            
            const responseTime = Date.now() - startTime;
            
            logger.info(`DKIM selector discovery completed successfully`, { 
                requestId, 
                domain: sanitizedDomain,
                selectorCount: selectors.length,
                responseTime 
            });

            return c.json({
                domain: sanitizedDomain,
                selectors,
                requestId,
                responseTime,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            const responseTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            
            logger.error(`DKIM selector discovery failed`, error as Error, { 
                requestId, 
                responseTime 
            });

            const statusCode = error instanceof Error && error.message.includes('timeout') ? 504 : 500;
            
            return c.json({ 
                error: errorMessage,
                requestId,
                responseTime,
                timestamp: new Date().toISOString()
            }, statusCode);
        }
    }
} 