import { SpfRecordObject, SpfValidationResults, SpfScoringResults, SpfScoreItem } from "../types";

/**
 * SPF Scoring Service that evaluates SPF records based on best practices and RFC compliance
 */
export class SpfScorer {
    /**
     * Calculates a comprehensive score for SPF records based on validation results
     * @param spfRecords Array of SPF record objects
     * @param validationResults Results from SPF validation
     * @returns Scoring results with detailed breakdown
     */
    calculateScore(spfRecords: SpfRecordObject[], validationResults: SpfValidationResults): SpfScoringResults {
        const scoreItems: SpfScoreItem[] = [];

        // 1. SPF Record Present (10 points)
        const spfRecordPresent = this.scoreSpfRecordPresent(validationResults, scoreItems);

        // 2. Single SPF Record (5 points)
        const singleSpfRecord = this.scoreSingleSpfRecord(validationResults, scoreItems);

        // 3. SPF Syntax Valid (5 points)
        const spfSyntaxValid = this.scoreSpfSyntaxValid(validationResults, scoreItems);

        // 4. Authorized Sources ≤ 10 Lookups (5 points)
        const authorizedSources = this.scoreAuthorizedSources(validationResults, scoreItems);

        // 5. No "Pass All" Mechanism (5 points)
        const noPassAll = this.scoreNoPassAll(validationResults, scoreItems);

        // 6. All Mechanism Policy (5 points)
        const allMechanismPolicy = this.scoreAllMechanismPolicy(validationResults, scoreItems);

        // 7. No Deprecated Mechanisms (2 points)
        const noDeprecatedMechanisms = this.scoreNoDeprecatedMechanisms(validationResults, scoreItems);

        // Calculate totals
        const totalScore = scoreItems.reduce((sum, item) => sum + item.score, 0);
        const maxPossibleScore = scoreItems.reduce((sum, item) => sum + item.maxScore, 0);
        const percentage = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;
        const grade = this.calculateGrade(percentage);

        return {
            totalScore,
            maxPossibleScore,
            percentage,
            grade,
            scoreItems
        };
    }

    /**
     * Scores SPF Record Present (10 points)
     */
    private scoreSpfRecordPresent(validationResults: SpfValidationResults, scoreItems: SpfScoreItem[]): number {
        const passed = validationResults.hasSpfRecord.isValid;
        const score = passed ? 10 : 0;
        
        scoreItems.push({
            name: "SPF Record Present",
            description: "SPF TXT record exists on the domain (with correct v=spf1). If missing, domain is unprotected by SPF.",
            score,
            maxScore: 10,
            passed,
            details: passed ? "SPF record found" : "No SPF record found"
        });

        return score;
    }

    /**
     * Scores Single SPF Record (5 points)
     */
    private scoreSingleSpfRecord(validationResults: SpfValidationResults, scoreItems: SpfScoreItem[]): number {
        const passed = validationResults.oneInitialSpfRecord.isValid;
        const score = passed ? 5 : 0;
        
        scoreItems.push({
            name: "Single SPF Record",
            description: "Only one SPF record is published (no duplicates). Multiple records cause SPF failure.",
            score,
            maxScore: 5,
            passed,
            details: passed ? "Single SPF record found" : "Multiple or no initial SPF records found"
        });

        return score;
    }

    /**
     * Scores SPF Syntax Valid (5 points)
     */
    private scoreSpfSyntaxValid(validationResults: SpfValidationResults, scoreItems: SpfScoreItem[]): number {
        const passed = validationResults.syntaxValidation.isValid;
        const score = passed ? 5 : 0;
        
        scoreItems.push({
            name: "SPF Syntax Valid",
            description: "SPF record is syntactically correct (no obvious errors, unrecognized mechanisms, or syntax violations).",
            score,
            maxScore: 5,
            passed,
            details: passed ? "Syntax validation passed" : `Syntax errors found: ${validationResults.syntaxValidation.errors.map(e => e.error).join(', ')}`
        });

        return score;
    }

    /**
     * Scores Authorized Sources ≤ 10 Lookups (5 points)
     */
    private scoreAuthorizedSources(validationResults: SpfValidationResults, scoreItems: SpfScoreItem[]): number {
        const passed = validationResults.maxTenSpfRecords.isValid;
        const score = passed ? 5 : 0;
        
        scoreItems.push({
            name: "Authorized Sources ≤ 10 Lookups",
            description: "SPF includes/redirects do not exceed 10 DNS lookups. (Staying within RFC limit avoids permerror.)",
            score,
            maxScore: 5,
            passed,
            details: passed ? "DNS lookups within limit" : "DNS lookups exceed 10"
        });

        return score;
    }

    /**
     * Scores No "Pass All" Mechanism (5 points)
     */
    private scoreNoPassAll(validationResults: SpfValidationResults, scoreItems: SpfScoreItem[]): number {
        const passed = validationResults.unsafeAllMechanism.isValid;
        const score = passed ? 5 : 0;
        
        scoreItems.push({
            name: "No \"Pass All\" Mechanism",
            description: "SPF does not use +all which would allow any sender.",
            score,
            maxScore: 5,
            passed,
            details: passed ? "No unsafe +all mechanism found" : "Unsafe +all mechanism found"
        });

        return score;
    }

    /**
     * Scores All Mechanism Policy (5 points)
     */
    private scoreAllMechanismPolicy(validationResults: SpfValidationResults, scoreItems: SpfScoreItem[]): number {
        const qualifier = validationResults.firstAllQualifier.qualifier;
        let score = 0;
        let details = "";

        if (qualifier === '-') {
            score = 5;
            details = "Hard fail (-all) configured: strict enforcement";
        } else if (qualifier === '~') {
            score = 3;
            details = "Soft fail (~all) configured: partial credit, more relaxed";
        } else if (qualifier === '?' || qualifier === '+') {
            score = 0;
            details = qualifier === '?' ? "Neutral (?all) configured: poor policy" : "Pass all (+all) configured: poor policy";
        } else {
            score = 0;
            details = "No 'all' mechanism found: missing policy is poor";
        }

        const passed = score >= 3; // Consider 3+ points as passing
        
        scoreItems.push({
            name: "All Mechanism Policy",
            description: "SPF uses an appropriate policy on \"all\": -all (hard fail) configured: 5 points (strict enforcement). ~all (soft fail): 3 points (partial credit, more relaxed). ?all or no all: 0 (neutral or missing policy is poor).",
            score,
            maxScore: 5,
            passed,
            details
        });

        return score;
    }

    /**
     * Scores No Deprecated Mechanisms (2 points)
     */
    private scoreNoDeprecatedMechanisms(validationResults: SpfValidationResults, scoreItems: SpfScoreItem[]): number {
        const passed = validationResults.deprecatedMechanisms.isValid;
        const score = passed ? 5 : 0;
        
        scoreItems.push({
            name: "No Deprecated Mechanisms",
            description: "SPF record does not use deprecated mechanisms like ptr. (If none, give 2 points; if present, 0.)",
            score,
            maxScore: 5,
            passed,
            details: passed ? "No deprecated mechanisms found" : "Deprecated mechanisms found"
        });

        return score;
    }

    /**
     * Calculates grade based on percentage score
     */
    private calculateGrade(percentage: number): string {
        if (percentage >= 90) return "A";
        if (percentage >= 80) return "B";
        if (percentage >= 70) return "C";
        if (percentage >= 60) return "D";
        return "F";
    }
} 