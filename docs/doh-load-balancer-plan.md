# DoH Load Balancer Implementation Plan

## Overview

Implement a service that provides a random DNS-over-HTTPS (DoH) endpoint (from a list of providers, e.g., Cloudflare and Google) to internal consumers. This enables DNS query load balancing and redundancy. The service will expose an endpoint that returns a random DoH URL from the configured list.

---

## Tasks

### 1. Requirements & Design

- Define the list of supported DoH providers (e.g., Cloudflare, Google).
- Decide on the configuration method (static config, environment variable, or both).
- Specify the API contract for the service (e.g., `/doh-url` returns `{ url: string }`).

---

### 2. Configuration

- Update `AppConfig` in `src/config.ts` to support an array of DoH URLs (e.g., `dohUrls: string[]`).
- Allow configuration via environment variables (e.g., `DOH_URLS` as a comma-separated list).
- Update `getConfig` to parse and validate the list of DoH URLs.

---

### 3. Service Implementation

- Create a new service in `src/services/doh-balancer.ts`:
  - Implement a function to select a random DoH URL from the list.
  - Ensure the function is pure and stateless.
  - Add unit tests for random selection and edge cases (empty list, single entry).
- Refactor `dns-service.ts` to use the balancer:
  - Replace direct usage of `config.dns.dohUrl` with a call to the balancer.
  - Ensure retry logic can use a new random DoH URL on each attempt (optional, for advanced balancing).
- Refactor `spf-service.ts` to use the balancer:
  - Replace direct usage of `config.dns.dohUrl` with a call to the balancer.
  - Update the `getSpfRecord` function to use the balancer for all DNS queries.
  - Ensure recursive SPF lookups (includes/redirects) also use the balancer.

---

### 4. API Endpoint

- Add a new controller in `src/controllers/doh-controller.ts`:
  - Implement an endpoint (e.g., `GET /doh-url`) that returns a random DoH URL.
  - Validate and sanitize all outputs.
  - Add error handling for misconfiguration (e.g., empty DoH list).
- Register the new route in `src/index.ts` using Hono.

---

### 5. Testing

- Add unit tests for the balancer service (`tests/services/doh-balancer.test.ts`).
- Add controller tests for the new endpoint (`tests/controllers/doh-controller.test.ts`).
- Add integration tests to ensure the endpoint returns only configured URLs and handles errors gracefully.

---

### 6. Documentation

- Update `README.md` with usage instructions and configuration options.
- Document the new endpoint and its response format.
- Add examples for configuring multiple DoH providers.

---

### 7. Deployment & Validation

- Update deployment scripts/configs if new environment variables are required.
- Test in staging with multiple DoH providers.
- Monitor logs for errors or misconfigurations.

---

## Acceptance Criteria

- The `/doh-url` endpoint returns a random, valid DoH URL from the configured list.
- The DNS service uses the balancer for all outgoing DNS queries.
- The SPF service uses the balancer for all outgoing DNS queries.
- All new code is fully tested and documented.
- No breaking changes to existing DNS/SPF validation functionality. 