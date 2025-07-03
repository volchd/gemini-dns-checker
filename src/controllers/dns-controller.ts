import { Context } from "hono";
import { checkDnsRegistration } from "../services/dns-service";

/**
 * Handles the DNS check request.
 * It extracts the domain from the query parameters, validates it,
 * and then calls the dns-service to check its registration.
 * @param c The Hono context object.
 * @returns A JSON response indicating the DNS check result or an error.
 */
export async function checkDns(c: Context): Promise<Response> {
	// Extract the 'domain' query parameter from the request.
	const domain = c.req.query("domain");

	// If the domain parameter is missing, log an error and return a 400 Bad Request response.
	if (!domain) {
		console.log("Domain parameter is missing");
		return c.json({ error: "Domain parameter is required" }, 400);
	}

	console.log(`Received request to check domain: ${domain}`);

	// Basic domain validation using a regular expression.
	const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;
	// If the domain format is invalid, log an error and return a 400 Bad Request response.
	if (!domainRegex.test(domain)) {
		console.log(`Invalid domain format: ${domain}`);
		return c.json({ error: "Invalid domain format" }, 400);
	}

	try {
		console.log(`Checking DNS registration for domain: ${domain}`);
		// Call the dns-service to perform the actual DNS registration check.
		const result = await checkDnsRegistration(domain);
		console.log(`DNS check completed for domain: ${domain}`);
		// Return the result as a JSON response.
		return c.json(result);
	} catch (error) {
		// Catch any errors that occur during the DNS check.
		console.error(`Error checking DNS for domain: ${domain}`, error);
		// If the error is an instance of Error, return its message in the response.
		if (error instanceof Error) {
			return c.json({ error: error.message }, 500);
		} else {
			// For unknown errors, return a generic error message.
			return c.json({ error: "An unknown error occurred" }, 500);
		}
	}
}
