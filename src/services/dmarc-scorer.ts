import { DmarcRecord, DmarcScoreItem, DmarcScoringResults } from "../types";
import { logger } from "../utils/logger";

/**
 * DMARC Scoring Service that evaluates DMARC records based on best practices and RFC compliance
 */
export class DmarcScorer {
    /**
     * Calculates a comprehensive score for DMARC records based on best practices
     * @param dmarcRecord DMARC record for the domain
     * @returns Scoring results with detailed breakdown
     */
    calculateScore(dmarcRecord: DmarcRecord | null): DmarcScoringResults {
        const scoreItems: DmarcScoreItem[] = [];

        // 1. DMARC Record Present (10 points)
        const recordPresent = !!dmarcRecord;
        scoreItems.push(this.evaluateRecordPresence(recordPresent));

        // If no record, return immediately
        if (!recordPresent) {
            return this.finalize(scoreItems);
        }

        const parsed = dmarcRecord!.parsedData;

        // 2. DMARC Policy Enforcement (up to 10 points)
        scoreItems.push(this.evaluatePolicyEnforcement(parsed.policy));

        // 3. DMARC Coverage for Subdomains (5 points)
        scoreItems.push(this.evaluateSubdomainCoverage(parsed.policy, parsed.subdomainPolicy));

        // 4. DMARC Alignment Mode (5 points)
        scoreItems.push(this.evaluateAlignmentMode(parsed.alignmentSpf, parsed.alignmentDkim));

        // 5. DMARC Reporting (RUA) (5 points)
        scoreItems.push(this.evaluateReporting(parsed.reportEmails));

        // 6. DMARC Policy Percentage (5 points)
        scoreItems.push(this.evaluatePolicyPercentage(parsed.policy, parsed.percentage));

        return this.finalize(scoreItems);
    }

    /**
     * Evaluates whether a DMARC record is present
     * @param recordPresent Whether a DMARC record exists
     * @returns Score item for record presence
     */
    private evaluateRecordPresence(recordPresent: boolean): DmarcScoreItem {
        return {
            name: "DMARC Record Present",
            description: "DMARC TXT record found at _dmarc.domain. If missing, that's a major gap.",
            score: recordPresent ? 10 : 0,
            maxScore: 10,
            passed: recordPresent,
            details: recordPresent ? "DMARC record found" : "No DMARC record found"
        };
    }

    /**
     * Evaluates the DMARC policy enforcement level
     * @param policy The DMARC policy (p=)
     * @returns Score item for policy enforcement
     */
    private evaluatePolicyEnforcement(policy: string): DmarcScoreItem {
        let policyScore = 0;
        let policyDetails = "";
        
        switch (policy) {
            case "reject":
                policyScore = 10;
                policyDetails = "Policy is 'reject' (full enforcement)";
                break;
            case "quarantine":
                policyScore = 8;
                policyDetails = "Policy is 'quarantine' (partial enforcement)";
                break;
            case "none":
                policyScore = 3;
                policyDetails = "Policy is 'none' (monitor only, no protection)";
                break;
            default:
                policyScore = 0;
                policyDetails = `Policy is '${policy}' (invalid)`;
        }

        return {
            name: "DMARC Policy Enforcement",
            description: "The strictness of the DMARC policy (p=): reject=10, quarantine=8, none=3.",
            score: policyScore,
            maxScore: 10,
            passed: policyScore > 0,
            details: policyDetails
        };
    }

    /**
     * Evaluates DMARC coverage for subdomains
     * @param policy The main DMARC policy
     * @param subdomainPolicy The subdomain policy (sp=)
     * @returns Score item for subdomain coverage
     */
    private evaluateSubdomainCoverage(policy: string, subdomainPolicy?: string): DmarcScoreItem {
        let subdomainScore = 0;
        let subdomainDetails = "";

        if (subdomainPolicy) {
            if (
                (policy === "reject" && subdomainPolicy === "reject") ||
                (policy === "quarantine" && ["quarantine", "reject"].includes(subdomainPolicy)) ||
                (policy === "none" && ["none", "quarantine", "reject"].includes(subdomainPolicy))
            ) {
                subdomainScore = 5;
                subdomainDetails = `sp=${subdomainPolicy} (not weaker than p)`;
            } else {
                subdomainScore = 0;
                subdomainDetails = `sp=${subdomainPolicy} (weaker than p)`;
            }
        } else {
            // If no subdomain policy, assume full points unless there are significant subdomains (not checked here)
            subdomainScore = 5;
            subdomainDetails = "No subdomain policy set or not needed";
        }

        return {
            name: "DMARC Coverage for Subdomains",
            description: "Subdomain policy in place (sp=) and not weaker than p, or not needed.",
            score: subdomainScore,
            maxScore: 5,
            passed: subdomainScore === 5,
            details: subdomainDetails
        };
    }

    /**
     * Evaluates DMARC alignment mode settings
     * @param alignmentSpf SPF alignment mode (aspf=)
     * @param alignmentDkim DKIM alignment mode (adkim=)
     * @returns Score item for alignment mode
     */
    private evaluateAlignmentMode(alignmentSpf?: string, alignmentDkim?: string): DmarcScoreItem {
        let alignmentScore = 0;
        let alignmentDetails = "";
        
        const aspf = alignmentSpf || "r";
        const adkim = alignmentDkim || "r";
        
        if (["r", "s"].includes(aspf) && ["r", "s"].includes(adkim)) {
            alignmentScore = 5;
            alignmentDetails = `aspf=${aspf}, adkim=${adkim}`;
        } else {
            alignmentScore = 0;
            alignmentDetails = `aspf=${aspf}, adkim=${adkim} (misconfigured)`;
        }

        return {
            name: "DMARC Alignment Mode",
            description: "Alignment setting (aspf/adkim): 2 points if relaxed (default) or strict, 0 if misconfigured.",
            score: alignmentScore,
            maxScore: 5,
            passed: alignmentScore === 5,
            details: alignmentDetails
        };
    }

    /**
     * Evaluates DMARC reporting configuration
     * @param reportEmails Array of reporting email addresses (rua=)
     * @returns Score item for reporting configuration
     */
    private evaluateReporting(reportEmails?: string[]): DmarcScoreItem {
        const ruaPresent = Array.isArray(reportEmails) && reportEmails.length > 0;
        
        return {
            name: "DMARC Reporting (RUA)",
            description: "Aggregate reporting address (rua) is specified to receive feedback.",
            score: ruaPresent ? 5 : 0,
            maxScore: 5,
            passed: ruaPresent,
            details: ruaPresent ? `rua=${reportEmails!.join(", ")}` : "No rua specified"
        };
    }

    /**
     * Evaluates DMARC policy percentage configuration
     * @param policy The DMARC policy
     * @param percentage The policy percentage (pct=)
     * @returns Score item for policy percentage
     */
    private evaluatePolicyPercentage(policy: string, percentage?: number): DmarcScoreItem {
        let pctScore = 0;
        let pctDetails = "";

        if (policy === "reject" || policy === "quarantine") {
            if (percentage === undefined || percentage === 100) {
                pctScore = 5;
                pctDetails = `pct=${percentage ?? 100}`;
            } else if (percentage >= 50) {
                pctScore = 2;
                pctDetails = `pct=${percentage}`;
            } else {
                pctScore = 0;
                pctDetails = `pct=${percentage}`;
            }
        } else {
            // If policy is 'none', pct is not applicable
            pctScore = 2;
            pctDetails = "Policy is 'none' (pct not applicable)";
        }

        return {
            name: "DMARC Policy Percentage",
            description: "If a policy is enforced (quarantine/reject), check that pct is 100 (full coverage).",
            score: pctScore,
            maxScore: 5,
            passed: pctScore === 5,
            details: pctDetails
        };
    }

    /**
     * Finalizes the scoring results by calculating totals and percentages
     * @param scoreItems Array of individual score items
     * @returns Final scoring results
     */
    private finalize(scoreItems: DmarcScoreItem[]): DmarcScoringResults {
        const totalScore = scoreItems.reduce((sum, item) => sum + item.score, 0);
        const maxPossibleScore = scoreItems.reduce((sum, item) => sum + item.maxScore, 0);
        const percentage = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;
        
        return {
            totalScore,
            maxPossibleScore,
            percentage,
            scoreItems
        };
    }
} 