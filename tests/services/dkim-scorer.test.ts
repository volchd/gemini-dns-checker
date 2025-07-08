import { DkimScorer } from '../../src/services/dkim-scorer';
import { DkimRecordSet } from '../../src/types';

describe('DkimScorer', () => {
    let scorer: DkimScorer;
    beforeEach(() => {
        scorer = new DkimScorer();
    });

    it('should score 0 if no DKIM records', async () => {
        const recordSet: DkimRecordSet = { domain: 'example.com', records: [], retrievedAt: new Date() };
        const result = await scorer.calculateScore(recordSet);
        expect(result.totalScore).toBe(0);
        expect(result.scoreItems[0].passed).toBe(false);
    });

    it('should score full points for 2048-bit DKIM key', async () => {
        // Mock a 2048-bit key (simulate modulusLength)
        const recordSet: DkimRecordSet = {
            domain: 'example.com',
            records: [{
                domain: 'example.com',
                selector: 'selector1',
                rawRecord: '',
                parsedData: {
                    version: 'DKIM1',
                    algorithm: 'rsa-sha256',
                    keyType: 'rsa',
                    publicKey: 'mock2048', // Will be patched
                    serviceType: undefined,
                    flags: undefined,
                    notes: undefined
                },
                retrievedAt: new Date()
            }],
            retrievedAt: new Date()
        };
        // Patch (globalThis as any).crypto.subtle.importKey to simulate modulusLength
        const origImportKey = (globalThis as any).crypto.subtle.importKey;
        (globalThis as any).crypto.subtle.importKey = jest.fn().mockResolvedValue({ algorithm: { modulusLength: 2048 } });
        const result = await scorer.calculateScore(recordSet);
        expect(result.scoreItems[1].score).toBe(5);
        (globalThis as any).crypto.subtle.importKey = origImportKey;
    });

    it('should score 3 points for 1024-bit DKIM key', async () => {
        const recordSet: DkimRecordSet = {
            domain: 'example.com',
            records: [{
                domain: 'example.com',
                selector: 'selector1',
                rawRecord: '',
                parsedData: {
                    version: 'DKIM1',
                    algorithm: 'rsa-sha256',
                    keyType: 'rsa',
                    publicKey: 'mock1024',
                    serviceType: undefined,
                    flags: undefined,
                    notes: undefined
                },
                retrievedAt: new Date()
            }],
            retrievedAt: new Date()
        };
        const origImportKey = (globalThis as any).crypto.subtle.importKey;
        (globalThis as any).crypto.subtle.importKey = jest.fn().mockResolvedValue({ algorithm: { modulusLength: 1024 } });
        const result = await scorer.calculateScore(recordSet);
        expect(result.scoreItems[1].score).toBe(3);
        (globalThis as any).crypto.subtle.importKey = origImportKey;
    });

    it('should score 0 for <1024-bit DKIM key', async () => {
        const recordSet: DkimRecordSet = {
            domain: 'example.com',
            records: [{
                domain: 'example.com',
                selector: 'selector1',
                rawRecord: '',
                parsedData: {
                    version: 'DKIM1',
                    algorithm: 'rsa-sha256',
                    keyType: 'rsa',
                    publicKey: 'mock512',
                    serviceType: undefined,
                    flags: undefined,
                    notes: undefined
                },
                retrievedAt: new Date()
            }],
            retrievedAt: new Date()
        };
        const origImportKey = (globalThis as any).crypto.subtle.importKey;
        (globalThis as any).crypto.subtle.importKey = jest.fn().mockResolvedValue({ algorithm: { modulusLength: 512 } });
        const result = await scorer.calculateScore(recordSet);
        expect(result.scoreItems[1].score).toBe(0);
        (globalThis as any).crypto.subtle.importKey = origImportKey;
    });

    it('should score for multiple selectors', async () => {
        const recordSet: DkimRecordSet = {
            domain: 'example.com',
            records: [
                {
                    domain: 'example.com',
                    selector: 'selector1',
                    rawRecord: '',
                    parsedData: {
                        version: 'DKIM1',
                        algorithm: 'rsa-sha256',
                        keyType: 'rsa',
                        publicKey: 'mock2048',
                        serviceType: undefined,
                        flags: undefined,
                        notes: undefined
                    },
                    retrievedAt: new Date()
                },
                {
                    domain: 'example.com',
                    selector: 'selector2',
                    rawRecord: '',
                    parsedData: {
                        version: 'DKIM1',
                        algorithm: 'rsa-sha256',
                        keyType: 'rsa',
                        publicKey: 'mock2048',
                        serviceType: undefined,
                        flags: undefined,
                        notes: undefined
                    },
                    retrievedAt: new Date()
                }
            ],
            retrievedAt: new Date()
        };
        const origImportKey = (globalThis as any).crypto.subtle.importKey;
        (globalThis as any).crypto.subtle.importKey = jest.fn().mockResolvedValue({ algorithm: { modulusLength: 2048 } });
        const result = await scorer.calculateScore(recordSet);
        expect(result.scoreItems[2].score).toBe(3);
        (globalThis as any).crypto.subtle.importKey = origImportKey;
    });

    it('should score 0 for test mode flag', async () => {
        const recordSet: DkimRecordSet = {
            domain: 'example.com',
            records: [{
                domain: 'example.com',
                selector: 'selector1',
                rawRecord: '',
                parsedData: {
                    version: 'DKIM1',
                    algorithm: 'rsa-sha256',
                    keyType: 'rsa',
                    publicKey: 'mock2048',
                    serviceType: undefined,
                    flags: ['y'],
                    notes: undefined
                },
                retrievedAt: new Date()
            }],
            retrievedAt: new Date()
        };
        const origImportKey = (globalThis as any).crypto.subtle.importKey;
        (globalThis as any).crypto.subtle.importKey = jest.fn().mockResolvedValue({ algorithm: { modulusLength: 2048 } });
        const result = await scorer.calculateScore(recordSet);
        expect(result.scoreItems[3].score).toBe(0);
        (globalThis as any).crypto.subtle.importKey = origImportKey;
    });
}); 