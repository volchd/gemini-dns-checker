import { Context } from "hono";
import { checkDnsRegistration } from "../services/dns-service";

export async function checkDns(c: Context) {
	const domain = c.req.query("domain");

	if (!domain) {
		console.log("Domain parameter is missing");
		return c.json({ error: "Domain parameter is required" }, 400);
	}

	console.log(`Received request to check domain: ${domain}`);

	// Basic domain validation
	const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;
	if (!domainRegex.test(domain)) {
		console.log(`Invalid domain format: ${domain}`);
		return c.json({ error: "Invalid domain format" }, 400);
	}

	try {
		console.log(`Checking DNS registration for domain: ${domain}`);
		const result = await checkDnsRegistration(domain);
		console.log(`DNS check completed for domain: ${domain}`);
		return c.json(result);
	} catch (error) {
		console.error(`Error checking DNS for domain: ${domain}`, error);
		if (error instanceof Error) {
			return c.json({ error: error.message }, 500);
		} else {
			return c.json({ error: "An unknown error occurred" }, 500);
		}
	}
}
