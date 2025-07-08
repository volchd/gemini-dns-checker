import { DmarcScorer } from '../../src/services/dmarc-scorer';
import { DmarcRecord } from '../../src/types';

describe('DmarcScorer', () => {
    let scorer: DmarcScorer;
    beforeEach(() => {
        scorer = new DmarcScorer();
    });

    it('should score 0 if no DMARC record', () => {
        const result = scorer.calculateScore(null);
        expect(result.totalScore).toBe(0);
        expect(result.scoreItems[0].passed).toBe(false);
    });

    it('should score full points for reject policy, full coverage, reporting, alignment, subdomain policy', () => {
        const record: DmarcRecord = {
            domain: 'example.com',
            rawRecord: 'v=DMARC1; p=reject; sp=reject; rua=mailto:agg@example.com; adkim=s; aspf=s; pct=100',
            parsedData: {
                version: 'DMARC1',
                policy: 'reject',
                subdomainPolicy: 'reject',
                percentage: 100,
                reportEmails: ['agg@example.com'],
                alignmentSpf: 's',
                alignmentDkim: 's',
            },
            retrievedAt: new Date()
        };
        const result = scorer.calculateScore(record);
        expect(result.totalScore).toBe(29);
        expect(result.percentage).toBe(100);
        expect(result.scoreItems.every(item => item.passed)).toBe(true);
    });

    it('should score partial for quarantine policy and pct=50', () => {
        const record: DmarcRecord = {
            domain: 'example.com',
            rawRecord: 'v=DMARC1; p=quarantine; sp=quarantine; rua=mailto:agg@example.com; adkim=r; aspf=r; pct=50',
            parsedData: {
                version: 'DMARC1',
                policy: 'quarantine',
                subdomainPolicy: 'quarantine',
                percentage: 50,
                reportEmails: ['agg@example.com'],
                alignmentSpf: 'r',
                alignmentDkim: 'r',
            },
            retrievedAt: new Date()
        };
        const result = scorer.calculateScore(record);
        expect(result.scoreItems[1].score).toBe(8); // quarantine
        expect(result.scoreItems[5].score).toBe(1); // pct=50
    });

    it('should score low for policy none and no rua', () => {
        const record: DmarcRecord = {
            domain: 'example.com',
            rawRecord: 'v=DMARC1; p=none',
            parsedData: {
                version: 'DMARC1',
                policy: 'none',
            },
            retrievedAt: new Date()
        };
        const result = scorer.calculateScore(record);
        expect(result.scoreItems[1].score).toBe(3); // policy none
        expect(result.scoreItems[4].score).toBe(0); // no rua
        expect(result.scoreItems[5].score).toBe(2); // pct n/a
    });

    it('should score 0 for subdomain policy weaker than parent', () => {
        const record: DmarcRecord = {
            domain: 'example.com',
            rawRecord: 'v=DMARC1; p=reject; sp=none',
            parsedData: {
                version: 'DMARC1',
                policy: 'reject',
                subdomainPolicy: 'none',
            },
            retrievedAt: new Date()
        };
        const result = scorer.calculateScore(record);
        expect(result.scoreItems[2].score).toBe(0);
    });

    it('should score 0 for misconfigured alignment', () => {
        const record: DmarcRecord = {
            domain: 'example.com',
            rawRecord: 'v=DMARC1; p=reject; adkim=x; aspf=y',
            parsedData: {
                version: 'DMARC1',
                policy: 'reject',
                alignmentSpf: 'y',
                alignmentDkim: 'x',
            },
            retrievedAt: new Date()
        };
        const result = scorer.calculateScore(record);
        expect(result.scoreItems[3].score).toBe(0);
    });

    it('should handle missing pct as 100 for enforced policy', () => {
        const record: DmarcRecord = {
            domain: 'example.com',
            rawRecord: 'v=DMARC1; p=reject',
            parsedData: {
                version: 'DMARC1',
                policy: 'reject',
            },
            retrievedAt: new Date()
        };
        const result = scorer.calculateScore(record);
        expect(result.scoreItems[5].score).toBe(2);
    });
}); 