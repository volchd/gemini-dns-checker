import { Context } from "hono";
import { IDmarcService } from "../types";
import { logger } from "../utils/logger";
import { DmarcScorer } from "../services/dmarc-scorer";

export class DmarcController {
    private dmarcScorer: DmarcScorer;
    constructor(private dmarcService: IDmarcService) {
        this.dmarcScorer = new DmarcScorer();
    }

    async getDmarcRecord(c: Context) {
        const startTime = Date.now();
        const requestId = crypto.randomUUID();
        
        logger.info(`DMARC record request received`, { 
            requestId, 
            endpoint: '/dmarc/record',
            userAgent: c.req.header('User-Agent') 
        });

        try {
            const domain = c.req.query('domain');
            
            if (!domain) {
                logger.warn(`DMARC request missing domain parameter`, { requestId });
                return c.json({ 
                    error: 'Domain parameter is required',
                    requestId 
                }, 400);
            }

            logger.debug(`DMARC record request for domain: ${domain}`, { requestId });
            const record = await this.dmarcService.getDmarcRecord(domain);

            if (!record) {
                const responseTime = Date.now() - startTime;
                logger.info(`No DMARC record found`, { 
                    requestId, 
                    domain,
                    responseTime 
                });
                return c.json({ 
                    error: 'No DMARC record found',
                    requestId,
                    responseTime,
                    timestamp: new Date().toISOString()
                }, 404);
            }

            // Calculate DMARC score
            const score = this.dmarcScorer.calculateScore(record);
            const responseTime = Date.now() - startTime;
            
            logger.info(`DMARC record retrieved successfully`, { 
                requestId, 
                domain,
                responseTime 
            });

            return c.json({
                record,
                score,
                requestId,
                responseTime,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            const responseTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            
            logger.error('Error in getDmarcRecord controller', error as Error, { 
                requestId, 
                responseTime 
            });
            
            return c.json({ 
                error: 'Internal server error',
                requestId,
                responseTime,
                timestamp: new Date().toISOString()
            }, 500);
        }
    }

    async validateDmarcRecord(c: Context) {
        const startTime = Date.now();
        const requestId = crypto.randomUUID();
        
        logger.info(`DMARC validation request received`, { 
            requestId, 
            endpoint: '/dmarc/validate',
            userAgent: c.req.header('User-Agent') 
        });

        try {
            const domain = c.req.query('domain');
            
            if (!domain) {
                logger.warn(`DMARC validation request missing domain parameter`, { requestId });
                return c.json({ 
                    error: 'Domain parameter is required',
                    requestId 
                }, 400);
            }

            logger.debug(`DMARC validation request for domain: ${domain}`, { requestId });
            const validationResult = await this.dmarcService.validateDmarcRecord(domain);
            const responseTime = Date.now() - startTime;
            
            logger.info(`DMARC validation completed successfully`, { 
                requestId, 
                domain,
                isValid: validationResult.isValid,
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
            
            logger.error('Error in validateDmarcRecord controller', error as Error, { 
                requestId, 
                responseTime 
            });
            
            return c.json({ 
                error: 'Internal server error',
                requestId,
                responseTime,
                timestamp: new Date().toISOString()
            }, 500);
        }
    }
} 