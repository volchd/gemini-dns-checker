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
        scoreItems.push({
            name: "DMARC Record Present",
            description: "DMARC TXT record found at _dmarc.domain. If missing, that’s a major gap.",
            score: recordPresent ? 10 : 0,
            maxScore: 10,
            passed: recordPresent,
            details: recordPresent ? "DMARC record found" : "No DMARC record found"
        });

        // If no record, return immediately
        if (!recordPresent) {
            return this._finalize(scoreItems);
        }

        const parsed = dmarcRecord!.parsedData;

        // 2. DMARC Policy Enforcement (up to 10 points)
        let policyScore = 0;
        let policyDetails = "";
        switch (parsed.policy) {
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
                policyDetails = `Policy is '${parsed.policy}' (invalid)`;
        }
        scoreItems.push({
            name: "DMARC Policy Enforcement",
            description: "The strictness of the DMARC policy (p=): reject=10, quarantine=8, none=3.",
            score: policyScore,
            maxScore: 10,
            passed: policyScore > 0,
            details: policyDetails
        });

        // 3. DMARC Coverage for Subdomains (5 points)
        let subdomainScore = 0;
        let subdomainDetails = "";
        if (parsed.subdomainPolicy) {
            if (
                (parsed.policy === "reject" && parsed.subdomainPolicy === "reject") ||
                (parsed.policy === "quarantine" && ["quarantine", "reject"].includes(parsed.subdomainPolicy)) ||
                (parsed.policy === "none" && ["none", "quarantine", "reject"].includes(parsed.subdomainPolicy))
            ) {
                subdomainScore = 5;
                subdomainDetails = `sp=${parsed.subdomainPolicy} (not weaker than p)`;
            } else {
                subdomainScore = 0;
                subdomainDetails = `sp=${parsed.subdomainPolicy} (weaker than p)`;
            }
        } else {
            // If no subdomain policy, assume full points unless there are significant subdomains (not checked here)
            subdomainScore = 5;
            subdomainDetails = "No subdomain policy set or not needed";
        }
        scoreItems.push({
            name: "DMARC Coverage for Subdomains",
            description: "Subdomain policy in place (sp=) and not weaker than p, or not needed.",
            score: subdomainScore,
            maxScore: 5,
            passed: subdomainScore === 3,
            details: subdomainDetails
        });

        // 4. DMARC Alignment Mode (5 points)
        let alignmentScore = 0;
        let alignmentDetails = "";
        const aspf = parsed.alignmentSpf || "r";
        const adkim = parsed.alignmentDkim || "r";
        if (["r", "s"].includes(aspf) && ["r", "s"].includes(adkim)) {
            alignmentScore = 5;
            alignmentDetails = `aspf=${aspf}, adkim=${adkim}`;
        } else {
            alignmentScore = 0;
            alignmentDetails = `aspf=${aspf}, adkim=${adkim} (misconfigured)`;
        }
        scoreItems.push({
            name: "DMARC Alignment Mode",
            description: "Alignment setting (aspf/adkim): 2 points if relaxed (default) or strict, 0 if misconfigured.",
            score: alignmentScore,
            maxScore: 5,
            passed: alignmentScore === 5,
            details: alignmentDetails
        });

        // 5. DMARC Reporting (RUA) (5 points)
        const ruaPresent = Array.isArray(parsed.reportEmails) && parsed.reportEmails.length > 0;
        scoreItems.push({
            name: "DMARC Reporting (RUA)",
            description: "Aggregate reporting address (rua) is specified to receive feedback.",
            score: ruaPresent ? 5: 0,
            maxScore: 5,
            passed: ruaPresent,
            details: ruaPresent ? `rua=${parsed.reportEmails!.join(", ")}` : "No rua specified"
        });

        // 6. DMARC Policy Percentage (5 points)
        let pctScore = 0;
        let pctDetails = "";
        if (parsed.policy === "reject" || parsed.policy === "quarantine") {
            if (parsed.percentage === undefined || parsed.percentage === 100) {
                pctScore = 5;
                pctDetails = `pct=${parsed.percentage ?? 100}`;
            } else if (parsed.percentage >= 50) {
                pctScore = 2;
                pctDetails = `pct=${parsed.percentage}`;
            } else {
                pctScore = 0;
                pctDetails = `pct=${parsed.percentage}`;
            }
        } else {
            // If policy is 'none', pct is not applicable
            pctScore = 2;
            pctDetails = "Policy is 'none' (pct not applicable)";
        }
        scoreItems.push({
            name: "DMARC Policy Percentage",
            description: "If a policy is enforced (quarantine/reject), check that pct is 100 (full coverage).",
            score: pctScore,
            maxScore: 5,
            passed: pctScore === 5,
            details: pctDetails
        });

        return this._finalize(scoreItems);
    }

    private _finalize(scoreItems: DmarcScoreItem[]): DmarcScoringResults {
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