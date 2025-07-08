import { Context } from 'hono';
import { DkimController } from '../../src/controllers/dkim-controller';
import { DkimService } from '../../src/services/dkim-service';
import { ValidationError } from '../../src/utils/validation';
import { DkimRecord, DkimRecordSet, DkimValidationResult } from '../../src/types';
import { MockDnsService } from '../mocks/dns-mock';
import { DKIM_TEST_DATA } from '../fixtures/test-data';

describe('DkimController', () => {
    let dkimController: DkimController;
    let dkimService: DkimService;
    let mockDnsService: MockDnsService;
    let mockContext: {
        req: { param: jest.Mock };
        json: jest.Mock;
    };

    beforeEach(() => {
        mockDnsService = new MockDnsService();
        dkimService = new DkimService(mockDnsService);
        dkimController = new DkimController(dkimService);

        mockContext = {
            req: {
                param: jest.fn()
            },
            json: jest.fn()
        };
    });

    describe('getDkimRecords', () => {
        it('should return DKIM records for valid domain', async () => {
            const domain = DKIM_TEST_DATA.testDomains.withMultipleRecords;
            const mockRecords: DkimRecordSet = {
                domain,
                records: [
                    {
                        domain,
                        selector: 'selector1',
                        rawRecord: DKIM_TEST_DATA.validRecords.selector1,
                        parsedData: {
                            version: 'DKIM1',
                            algorithm: 'rsa-sha256',
                            keyType: 'rsa',
                            publicKey: 'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC',
                            serviceType: 'email',
                            flags: undefined,
                            notes: undefined
                        },
                        retrievedAt: new Date()
                    },
                    {
                        domain,
                        selector: 'selector2',
                        rawRecord: DKIM_TEST_DATA.validRecords.selector2,
                        parsedData: {
                            version: 'DKIM1',
                            algorithm: 'rsa-sha256',
                            keyType: 'rsa',
                            publicKey: 'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC',
                            serviceType: undefined,
                            flags: undefined,
                            notes: undefined
                        },
                        retrievedAt: new Date()
                    }
                ],
                retrievedAt: new Date()
            };

            mockContext.req.param.mockReturnValue(domain);

            await dkimController.getDkimRecords(mockContext as unknown as Context);

            expect(mockContext.json).toHaveBeenCalledWith(expect.objectContaining({
                domain,
                records: expect.arrayContaining([
                    expect.objectContaining({
                        selector: 'selector1',
                        parsedData: expect.objectContaining({
                            version: 'DKIM1',
                            algorithm: 'rsa-sha256'
                        })
                    }),
                    expect.objectContaining({
                        selector: 'selector2',
                        parsedData: expect.objectContaining({
                            version: 'DKIM1',
                            algorithm: 'rsa-sha256'
                        })
                    })
                ])
            }));
        });

        it('should return 400 when domain is missing', async () => {
            mockContext.req.param.mockReturnValue(undefined);

            await dkimController.getDkimRecords(mockContext as unknown as Context);

            expect(mockContext.json).toHaveBeenCalledWith(
                { error: 'Domain parameter is required' },
                400
            );
        });
    });

    describe('getDkimRecord', () => {
        it('should return specific DKIM record', async () => {
            const domain = DKIM_TEST_DATA.testDomains.valid;
            const selector = 'google';

            mockContext.req.param.mockImplementation((param: string) => {
                if (param === 'domain') return domain;
                if (param === 'selector') return selector;
                return undefined;
            });

            await dkimController.getDkimRecord(mockContext as unknown as Context);

            expect(mockContext.json).toHaveBeenCalledWith(expect.objectContaining({
                domain,
                selector,
                parsedData: expect.objectContaining({
                    version: 'DKIM1',
                    keyType: 'rsa',
                    flags: ['y', 's']
                })
            }));
        });

        it('should return 400 when parameters are missing', async () => {
            mockContext.req.param.mockReturnValue(undefined);

            await dkimController.getDkimRecord(mockContext as unknown as Context);

            expect(mockContext.json).toHaveBeenCalledWith(
                { error: 'Domain and selector parameters are required' },
                400
            );
        });
    });

    describe('validateDkimRecords', () => {
        it('should return validation results', async () => {
            const domain = DKIM_TEST_DATA.testDomains.withMultipleRecords;

            mockContext.req.param.mockReturnValue(domain);

            await dkimController.validateDkimRecords(mockContext as unknown as Context);

            expect(mockContext.json).toHaveBeenCalledWith(expect.objectContaining({
                domain,
                isValid: true,
                records: expect.arrayContaining([
                    expect.objectContaining({
                        selector: 'selector1',
                        isValid: true,
                        checks: expect.objectContaining({
                            hasValidVersion: true,
                            hasValidAlgorithm: true
                        })
                    }),
                    expect.objectContaining({
                        selector: 'selector2',
                        isValid: true,
                        checks: expect.objectContaining({
                            hasValidVersion: true,
                            hasValidAlgorithm: true
                        })
                    })
                ])
            }));
        });

        it('should return 400 when domain is missing', async () => {
            mockContext.req.param.mockReturnValue(undefined);

            await dkimController.validateDkimRecords(mockContext as unknown as Context);

            expect(mockContext.json).toHaveBeenCalledWith(
                { error: 'Domain parameter is required' },
                400
            );
        });
    });

    describe('discoverSelectors', () => {
        it('should return discovered selectors', async () => {
            const domain = DKIM_TEST_DATA.testDomains.withMultipleRecords;

            mockContext.req.param.mockReturnValue(domain);

            await dkimController.discoverSelectors(mockContext as unknown as Context);

            expect(mockContext.json).toHaveBeenCalledWith({
                domain,
                selectors: ['selector1', 'selector2']
            });
        });

        it('should return 400 when domain is missing', async () => {
            mockContext.req.param.mockReturnValue(undefined);

            await dkimController.discoverSelectors(mockContext as unknown as Context);

            expect(mockContext.json).toHaveBeenCalledWith(
                { error: 'Domain parameter is required' },
                400
            );
        });

        it('should return empty selectors array for domain without DKIM', async () => {
            const domain = DKIM_TEST_DATA.testDomains.withNoRecords;

            mockContext.req.param.mockReturnValue(domain);

            await dkimController.discoverSelectors(mockContext as unknown as Context);

            expect(mockContext.json).toHaveBeenCalledWith({
                domain,
                selectors: []
            });
        });
    });
}); 