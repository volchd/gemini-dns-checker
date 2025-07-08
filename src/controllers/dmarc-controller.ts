import { Context } from "hono";
import { IDmarcService } from "../types";
import { logger } from "../utils/logger";

export class DmarcController {
    constructor(private dmarcService: IDmarcService) {}

    async getDmarcRecord(c: Context) {
        try {
            const domain = c.req.query('domain');
            
            if (!domain) {
                return c.json({ error: 'Domain parameter is required' }, 400);
            }

            logger.debug(`DMARC record request for domain: ${domain}`);
            const record = await this.dmarcService.getDmarcRecord(domain);

            if (!record) {
                return c.json({ error: 'No DMARC record found' }, 404);
            }

            return c.json(record);
        } catch (error) {
            logger.error('Error in getDmarcRecord controller', error as Error);
            return c.json({ error: 'Internal server error' }, 500);
        }
    }

    async validateDmarcRecord(c: Context) {
        try {
            const domain = c.req.query('domain');
            
            if (!domain) {
                return c.json({ error: 'Domain parameter is required' }, 400);
            }

            logger.debug(`DMARC validation request for domain: ${domain}`);
            const validationResult = await this.dmarcService.validateDmarcRecord(domain);

            return c.json(validationResult);
        } catch (error) {
            logger.error('Error in validateDmarcRecord controller', error as Error);
            return c.json({ error: 'Internal server error' }, 500);
        }
    }
} 