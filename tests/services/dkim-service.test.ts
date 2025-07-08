import { DkimService } from '../../src/services/dkim-service';
import { MockDnsService } from '../mocks/dns-mock';
import { DKIM_TEST_DATA } from '../fixtures/test-data';

describe('DkimService', () => {
    let dkimService: DkimService;
    let mockDnsService: MockDnsService;

    beforeEach(() => {
        mockDnsService = new MockDnsService();
        dkimService = new DkimService(mockDnsService);
    });

    describe('getDkimRecord', () => {
        it('should fetch and parse a valid DKIM record', async () => {
            const domain = DKIM_TEST_DATA.testDomains.valid;
            const selector = 'google';
            const rawRecord = DKIM_TEST_DATA.validRecords.google;

            const result = await dkimService.getDkimRecord(domain, selector);

            expect(result).toEqual({
                domain,
                selector,
                rawRecord,
                parsedData: {
                    version: 'DKIM1',
                    keyType: 'rsa',
                    publicKey: 'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC',
                    algorithm: '',
                    flags: ['y', 's'],
                    notes: 'test notes',
                    serviceType: undefined
                },
                retrievedAt: expect.any(Date)
            });
        });

        it('should throw error when no DKIM record found', async () => {
            const domain = DKIM_TEST_DATA.testDomains.withNoRecords;
            const selector = 'nonexistent';

            await expect(dkimService.getDkimRecord(domain, selector))
                .rejects
                .toThrow('No DKIM record found');
        });
    });

    describe('discoverSelectors', () => {
        it('should discover available selectors', async () => {
            const domain = DKIM_TEST_DATA.testDomains.withMultipleRecords;

            const result = await dkimService.discoverSelectors(domain);

            expect(result).toEqual(['selector1', 'selector2']);
        });

        it('should return empty array when no selectors found', async () => {
            const domain = DKIM_TEST_DATA.testDomains.withNoRecords;

            const result = await dkimService.discoverSelectors(domain);

            expect(result).toEqual([]);
        });

        it('should use cached results within TTL', async () => {
            const domain = DKIM_TEST_DATA.testDomains.withMultipleRecords;
            const spy = jest.spyOn(mockDnsService, 'queryTxt');

            await dkimService.discoverSelectors(domain);
            spy.mockClear();
            const result = await dkimService.discoverSelectors(domain);

            expect(result).toEqual(['selector1', 'selector2']);
            expect(spy).not.toHaveBeenCalled();
        });
    });

    describe('validateDkimRecords', () => {
        it('should validate multiple DKIM records', async () => {
            const domain = DKIM_TEST_DATA.testDomains.withMultipleRecords;

            const result = await dkimService.validateDkimRecords(domain);

            expect(result.isValid).toBe(true);
            expect(result.records).toHaveLength(2);
            expect(result.records[0].isValid).toBe(true);
            expect(result.records[0].checks.hasValidVersion).toBe(true);
            expect(result.records[0].checks.hasValidAlgorithm).toBe(true);
            expect(result.records[0].checks.hasValidPublicKey).toBe(true);
        });

        it('should report invalid records', async () => {
            const domain = DKIM_TEST_DATA.testDomains.withInvalidRecords;

            const result = await dkimService.validateDkimRecords(domain);

            expect(result.isValid).toBe(false);
            expect(result.records[0].isValid).toBe(false);
            expect(result.records[0].issues).toHaveLength(2); // Version and algorithm issues
        });
    });

    describe('parseDkimRecord', () => {
        it('should parse all DKIM record components', () => {
            const record = DKIM_TEST_DATA.validRecords.selector1;
            
            const result = dkimService.parseDkimRecord(record);

            expect(result).toEqual({
                version: 'DKIM1',
                algorithm: 'rsa-sha256',
                keyType: 'rsa',
                publicKey: 'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC',
                serviceType: 'email',
                flags: undefined,
                notes: undefined
            });
        });

        it('should handle missing optional components', () => {
            const record = 'v=DKIM1; k=rsa; p=MIGfMA0';
            
            const result = dkimService.parseDkimRecord(record);

            expect(result).toEqual({
                version: 'DKIM1',
                algorithm: '',
                keyType: 'rsa',
                publicKey: 'MIGfMA0',
                serviceType: undefined,
                flags: undefined,
                notes: undefined
            });
        });
    });
}); 