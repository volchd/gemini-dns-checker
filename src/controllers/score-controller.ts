import { Context } from "hono";
import { getSpfRecord } from "../services/spf-service";
import { SpfValidator } from "../services/spf-validator";
import { SpfScorer } from "../services/spf-scorer";
import { DkimService } from "../services/dkim-service";
import { DkimScorer } from "../services/dkim-scorer";
import { DmarcServiceImpl } from "../services/dmarc-service";
import { DmarcScorer } from "../services/dmarc-scorer";
import { DomainValidator, ValidationError } from "../utils/validation";
import { AppConfig } from "../config";
import { logger } from "../utils/logger";
import { DnsServiceImpl } from "../services/dns-service";

export function createScoreController(config: AppConfig) {
  // DKIM and DMARC services require DNS service
  const dnsService = new DnsServiceImpl();
  const dkimService = new DkimService(dnsService);
  const dkimScorer = new DkimScorer();
  const dmarcService = new DmarcServiceImpl(dnsService);
  const dmarcScorer = new DmarcScorer();

  return async function handleScoreRequest(c: Context): Promise<Response> {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();
    logger.info("Score request received", { requestId, endpoint: "/api/score", userAgent: c.req.header("User-Agent") });

    try {
      const domain = c.req.query("domain");
      if (!domain) {
        logger.warn("Score request missing domain parameter", { requestId });
        return c.json({ error: "Domain parameter is required", requestId }, 400);
      }
      // Validate and sanitize domain
      try {
        DomainValidator.validate(domain);
      } catch (validationError) {
        const error = validationError as ValidationError;
        logger.warn("Score request with invalid domain", { requestId, domain, error: error.message });
        return c.json({ error: error.message, field: error.field, requestId }, 400);
      }
      const sanitizedDomain = DomainValidator.sanitize(domain);
      logger.info("Starting scoring for domain", { requestId, domain: sanitizedDomain });

      // SPF
      const spfRecords = await getSpfRecord(sanitizedDomain, new Set(), "initial", config);
      const spfValidator = new SpfValidator();
      const { validationResults: spfValidation, scoringResults: spfScore } = spfValidator.validateWithScoring(spfRecords);

      // DKIM
      const dkimRecords = await dkimService.getDkimRecords(sanitizedDomain);
      const dkimScore = await dkimScorer.calculateScore(dkimRecords);

      // DMARC
      const dmarcRecord = await dmarcService.getDmarcRecord(sanitizedDomain);
      const dmarcScore = dmarcScorer.calculateScore(dmarcRecord);

      // Total score (sum of all max scores and actual scores)
      const totalScore = spfScore.totalScore + dkimScore.totalScore + dmarcScore.totalScore;
      const maxPossibleScore = spfScore.maxPossibleScore + dkimScore.maxPossibleScore + dmarcScore.maxPossibleScore;
      const percentage = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;

      const responseTime = Date.now() - startTime;
      logger.info("Score completed", { requestId, domain: sanitizedDomain, totalScore, percentage, responseTime });

      return c.json({
        domain: sanitizedDomain,
        scores: {
          spf: spfScore,
          dkim: dkimScore,
          dmarc: dmarcScore
        },
        totalScore,
        maxPossibleScore,
        percentage,
        requestId,
        responseTime,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      logger.error("Score endpoint failed", error as Error, { requestId, responseTime });
      return c.json({ error: errorMessage, requestId, responseTime, timestamp: new Date().toISOString() }, 500);
    }
  };
} 