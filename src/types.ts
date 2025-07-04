export interface DnsResponse {
	Status: number;
	Answer?: { name: string; type: number; TTL: number; data: string }[];
}

export interface SpfRecordObject {
	domain: string;
	spfRecord: string;
	type: 'initial' | 'include' | 'redirect';
}

export interface SpfValidationResults {
    hasSpfRecord: {
        isValid: boolean;
        message?: string;
    };
    syntaxValidation: {
        isValid: boolean;
        errors: { record: SpfRecordObject; error: string }[];
    };
    oneInitialSpfRecord: {
        isValid: boolean;
        message?: string;
    };
    maxTenSpfRecords: {
        isValid: boolean;
        message?: string;
    };
    deprecatedMechanisms: {
        isValid: boolean;
        errors: { record: SpfRecordObject; error: string }[];
    };
    unsafeAllMechanism: {
        isValid: boolean;
        errors: { record: SpfRecordObject; error: string }[];
    };
    firstAllQualifier: {
        qualifier: string | null;
        message?: string;
    };
}

export interface SpfScoreItem {
    name: string;
    description: string;
    score: number;
    maxScore: number;
    passed: boolean;
    details?: string;
}

export interface SpfScoringResults {
    totalScore: number;
    maxPossibleScore: number;
    percentage: number;
    grade: string;
    scoreItems: SpfScoreItem[];
}