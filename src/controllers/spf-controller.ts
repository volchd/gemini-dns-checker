import { getSpfRecord } from '../services/spf-service';
import { SpfValidator } from '../services/spf-validator';
import { Context } from 'hono';
import { SpfValidationResults } from '../types';

/**
 * Handles requests related to SPF record validation.
 * It extracts the domain from the query parameters, fetches SPF records,
 * validates them using SpfValidator, and returns the results.
 * @param c The Hono context object.
 * @returns A JSON response containing the SPF records and validation results, or an error.
 */
export async function handleSpfRequest(c: Context): Promise<Response> {
	// Extract the 'domain' query parameter from the request.
	const url = new URL(c.req.url);
	const domain = c.req.query('domain');

	// If the domain parameter is missing, return a 400 Bad Request response.
	if (!domain) {
		return c.json({ error: 'Missing domain parameter' }, 400);
	}

	try {
		// Fetch SPF records for the given domain using the spf-service.
		const spfRecords = await getSpfRecord(domain);
		// Create an instance of SpfValidator.
		const spfValidator = new SpfValidator();
		// Validate the fetched SPF records.
		const validationResults: SpfValidationResults = spfValidator.validate(spfRecords);
		// Return the domain, SPF records, and validation results as a JSON response.
		return c.json({ domain, spfRecords, validationResults });
	} catch (error) {
		// Catch any errors that occur during the process.
		console.error('Error handling SPF request:', error);
		// Return a 500 Internal Server Error response.
		return c.json({ error: 'Error retrieving SPF record' }, 500);
	}
}
