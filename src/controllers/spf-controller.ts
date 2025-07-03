import { getSpfRecord } from '../services/spf-service';
import { SpfValidator } from '../services/spf-validator';
import { Context } from 'hono';

export async function handleSpfRequest(c: Context): Promise<Response> {
	const url = new URL(c.req.url);
	const domain = c.req.query('domain');

	if (!domain) {
		return c.json({ error: 'Missing domain parameter' }, 400);
	}

	try {
		const spfRecords = await getSpfRecord(domain);
		const spfValidator = new SpfValidator();
		const validationResults = spfValidator.validate(spfRecords);
		return c.json({ domain, spfRecords, validationResults });
	} catch (error) {
		console.error('Error handling SPF request:', error);
		return c.json({ error: 'Error retrieving SPF record' }, 500);
	}
}
