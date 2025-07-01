import { getSpfRecord } from '../services/spf-service';
import { Context } from 'hono';

export async function handleSpfRequest(c: Context): Promise<Response> {
	const url = new URL(c.req.url);
	const domain = c.req.query('domain');

	if (!domain) {
		return new Response('Missing domain parameter', { status: 400 });
	}

	try {
		const spfRecord = await getSpfRecord(domain);
		return new Response(JSON.stringify({ domain, spfRecord }), { headers: { 'Content-Type': 'application/json' } });
	} catch (error) {
		console.error('Error handling SPF request:', error);
		return new Response('Error retrieving SPF record', { status: 500 });
	}
}
