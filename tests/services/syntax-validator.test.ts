import { SpfRecordObject } from '../../src/types';
import { SpfValidator } from '../../src/services/spf-validator';

describe('SyntaxValidator', () => {
    let validator: SpfValidator;

    beforeEach(() => {
        validator = new SpfValidator();
    });

    it('should return an empty array for a valid SPF record', () => {
        const spfRecords: SpfRecordObject[] = [
            { domain: 'example.com', spfRecord: 'v=spf1 include:_spf.google.com ~all', type: 'initial' as const },
            { domain: '_spf.google.com', spfRecord: 'v=spf1 ip4:1.2.3.4 -all', type: 'include' as const },
        ];
        expect(validator.validateSpfSyntax(spfRecords)).toEqual([]);
    });

    it('should return errors for invalid SPF records', () => {
        const spfRecords: SpfRecordObject[] = [
            { domain: 'example.com', spfRecord: 'v=spf2 include:_spf.google.com ~all', type: 'initial' as const }, // Invalid version
            { domain: 'example.com', spfRecord: 'v=spf1 include:_spf.google.com allx', type: 'initial' as const }, // Invalid mechanism
            { domain: 'example.com', spfRecord: 'v=spf1 include:_spf.google.com', type: 'initial' as const }, // No all mechanism
            { domain: 'example.com', spfRecord: 'v=spf1 include:_spf.google.com ~all"', type: 'initial' as const }, // Trailing quote
        ];
        const errors = validator.validateSpfSyntax(spfRecords);
        expect(errors.length).toBe(4);
        expect(errors[0].error).toBe('Record must start with "v=spf1"');
        expect(errors[1].error).toBe('Unknown mechanism or modifier: allx');
        expect(errors[2].error).toBe('Record must end with an "all" mechanism or a "redirect" modifier');
        expect(errors[3].error).toBe('Unknown mechanism or modifier: all"');
    });
});
