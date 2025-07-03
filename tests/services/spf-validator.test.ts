import { SpfValidator } from '../../src/services/spf-validator';
import { SpfRecordObject } from '../../src/types';

describe('SpfValidator', () => {
	let validator: SpfValidator;

	beforeEach(() => {
		validator = new SpfValidator();
	});

	describe('validate', () => {
		it('should return a message if no SPF record is found', () => {
			const spfRecords: SpfRecordObject[] = [];
			const results = validator.validate(spfRecords);
			expect(results).toEqual([{ message: "No SPF record found." }]);
		});

		it('should return an empty array for a valid SPF record', () => {
			const spfRecords: SpfRecordObject[] = [
				{ domain: 'example.com', spfRecord: 'v=spf1 include:_spf.google.com ~all', type: 'initial' as const },
				{ domain: '_spf.google.com', spfRecord: 'v=spf1 ip4:1.2.3.4 -all', type: 'include' as const },
			];
			const results = validator.validate(spfRecords);
			expect(results).toEqual([]);
		});

		it('should return a message if there is more than one initial SPF record', () => {
			const spfRecords: SpfRecordObject[] = [
				{ domain: 'example.com', spfRecord: 'v=spf1 -all', type: 'initial' as const },
				{ domain: 'example.com', spfRecord: 'v=spf1 -all', type: 'initial' as const },
			];
			const results = validator.validate(spfRecords);
			expect(results).toEqual([{ message: "There should be exactly one initial SPF record." }]);
		});

		it('should return a message if the number of lookups exceeds 10', () => {
			const spfRecords: SpfRecordObject[] = [
				{ domain: 'example.com', spfRecord: 'v=spf1 -all', type: 'initial' as const },
				...Array(11).fill(null).map(() => ({ domain: 'include.com', spfRecord: 'v=spf1 -all', type: 'include' as const })),
			];
			const results = validator.validate(spfRecords);
			expect(results).toEqual([{ message: "The number of SPF record lookups should not exceed 10." }]);
		});

		it('should return a message for deprecated mechanisms', () => {
			const spfRecords: SpfRecordObject[] = [
				{ domain: 'example.com', spfRecord: 'v=spf1 ptr -all', type: 'initial' as const },
			];
			const results = validator.validate(spfRecords);
			expect(results).toEqual([
				{ record: spfRecords[0], error: 'Unknown mechanism or modifier: ptr' },
				{ record: spfRecords[0], error: 'Deprecated mechanism found: "ptr"' }
			]);
		});

		it('should return a message for unsafe "+all" or "all" mechanisms', () => {
			const spfRecords: SpfRecordObject[] = [
				{ domain: 'example.com', spfRecord: 'v=spf1 +all', type: 'initial' as const },
			];
			const results = validator.validate(spfRecords);
			expect(results).toEqual([{ record: spfRecords[0], error: 'Unsafe "+all" or "all" mechanism found' }]);
		});
	});
});