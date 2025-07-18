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

export interface DkimRecord {
    domain: string;
    selector: string;
    rawRecord: string;
    parsedData: {
        version: string;          // v=DKIM1
        algorithm: string;        // a=rsa-sha256
        keyType: string;         // k=rsa
        publicKey: string;       // p=base64encoded...
        serviceType?: string;    // s=email (optional)
        flags?: string[];       // t=y|s|... (optional)
        notes?: string;         // n=notes (optional)
    };
    retrievedAt: Date;
}

export interface DkimRecordSet {
    domain: string;
    records: DkimRecord[];
    retrievedAt: Date;
}

export type DkimValidationIssue = {
    code: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
};

export interface DkimValidationResult {
    domain: string;
    isValid: boolean;
    records: Array<{
        selector: string;
        isValid: boolean;
        checks: {
            hasValidSelector: boolean;
            hasValidVersion: boolean;
            hasValidAlgorithm: boolean;
            hasValidPublicKey: boolean;
            hasValidSyntax: boolean;
        };
        issues: DkimValidationIssue[];
    }>;
    domainIssues: DkimValidationIssue[];
}

export interface DkimScoreItem {
    name: string;
    description: string;
    score: number;
    maxScore: number;
    passed: boolean;
    details?: string;
}

export interface DkimScoringResults {
    totalScore: number;
    maxPossibleScore: number;
    percentage: number;
    scoreItems: DkimScoreItem[];
}

export interface IDkimService {
    getDkimRecords(domain: string): Promise<DkimRecordSet>;
    getDkimRecord(domain: string, selector: string): Promise<DkimRecord>;
    validateDkimRecords(domain: string): Promise<DkimValidationResult>;
    discoverSelectors(domain: string): Promise<string[]>;
    parseDkimRecord(record: string): DkimRecord['parsedData'];
}

export interface DmarcRecord {
    domain: string;
    rawRecord: string;
    parsedData: {
        version: string;          // v=DMARC1
        policy: string;          // p=none|quarantine|reject
        subdomainPolicy?: string; // sp=none|quarantine|reject
        percentage?: number;      // pct=
        reportFormat?: string[];  // rf=
        reportInterval?: number;  // ri=
        reportEmails?: string[];  // rua=
        forensicEmails?: string[]; // ruf=
        failureOptions?: string[]; // fo=
        alignmentSpf?: string;    // aspf=r|s
        alignmentDkim?: string;   // adkim=r|s
    };
    retrievedAt: Date;
}

export interface DmarcValidationIssue {
    code: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
}

export interface DmarcValidationResult {
    domain: string;
    isValid: boolean;
    record: DmarcRecord | null;
    checks: {
        hasValidVersion: boolean;
        hasValidPolicy: boolean;
        hasValidSyntax: boolean;
        hasValidReportAddresses: boolean;
    };
    issues: DmarcValidationIssue[];
}

export interface IDmarcService {
    getDmarcRecord(domain: string): Promise<DmarcRecord | null>;
    validateDmarcRecord(domain: string): Promise<DmarcValidationResult>;
    parseDmarcRecord(record: string): DmarcRecord['parsedData'];
}

export interface DmarcScoreItem {
    name: string;
    description: string;
    score: number;
    maxScore: number;
    passed: boolean;
    details?: string;
}

export interface DmarcScoringResults {
    totalScore: number;
    maxPossibleScore: number;
    percentage: number;
    scoreItems: DmarcScoreItem[];
}