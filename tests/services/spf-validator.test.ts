import { SpfValidator, SpfRecordObject } from '../../src/services/spf-validator';

describe('SpfValidator', () => {
	let validator: SpfValidator;

	beforeEach(() => {
		validator = new SpfValidator();
	});

	describe('hasSpfRecord', () => {
		it('should return true if SPF records are present', () => {
			const spfRecords: SpfRecordObject[] = [{ domain: 'example.com', spfRecord: 'v=spf1 -all', type: 'initial' as const }];
			expect(validator.hasSpfRecord(spfRecords)).toBe(true);
		});

		it('should return false if no SPF records are present', () => {
			const spfRecords: any[] = [];
			expect(validator.hasSpfRecord(spfRecords)).toBe(false);
		});
	});

	describe('validateSpfSyntax', () => {
		it('should return an empty array for valid SPF records', () => {
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

	describe('hasOneInitialSpfRecord', () => {
		it('should return true if exactly one initial SPF record is present', () => {
			const spfRecords: SpfRecordObject[] = [
				{ domain: 'example.com', spfRecord: 'v=spf1 -all', type: 'initial' as const },
			];
			expect(validator.hasOneInitialSpfRecord(spfRecords)).toBe(true);
		});

		it('should return false if no initial SPF record is present', () => {
			const spfRecords: SpfRecordObject[] = [
				{ domain: 'include.com', spfRecord: 'v=spf1 -all', type: 'include' as const },
			];
			expect(validator.hasOneInitialSpfRecord(spfRecords)).toBe(false);
		});

		it('should return false if more than one initial SPF record is present', () => {
			const spfRecords: SpfRecordObject[] = [
				{ domain: 'example.com', spfRecord: 'v=spf1 -all', type: 'initial' as const },
				{ domain: 'example.com', spfRecord: 'v=spf1 -all', type: 'initial' as const },
			];
			expect(validator.hasOneInitialSpfRecord(spfRecords)).toBe(false);
		});
	});

	describe('hasMaxTenSpfRecords', () => {
		it('should return true if non-initial SPF records are 10 or less', () => {
			const spfRecords: SpfRecordObject[] = [
				{ domain: 'example.com', spfRecord: 'v=spf1 -all', type: 'initial' as const },
				...Array(9).fill(null).map(() => ({ domain: 'include.com', spfRecord: 'v=spf1 -all', type: 'include' as const })),
			];
			expect(validator.hasMaxTenSpfRecords(spfRecords)).toBe(true);
		});

		it('should return true if non-initial SPF records are exactly 10', () => {
			const spfRecords: SpfRecordObject[] = [
				{ domain: 'example.com', spfRecord: 'v=spf1 -all', type: 'initial' as const },
				...Array(10).fill({ domain: 'include.com', spfRecord: 'v=spf1 -all', type: 'include' as const }),
			];
			expect(validator.hasMaxTenSpfRecords(spfRecords)).toBe(true);
		});

		it('should return false if non-initial SPF records are more than 10', () => {
			const spfRecords: SpfRecordObject[] = [
				{ domain: 'example.com', spfRecord: 'v=spf1 -all', type: 'initial' as const },
				...Array(11).fill(null).map(() => ({ domain: 'include.com', spfRecord: 'v=spf1 -all', type: 'include' as const })),
			];
			expect(validator.hasMaxTenSpfRecords(spfRecords)).toBe(false);
		});

		it('should return true if only initial SPF record is present', () => {
			const spfRecords: SpfRecordObject[] = [
				{ domain: 'example.com', spfRecord: 'v=spf1 -all', type: 'initial' as const },
			];
			expect(validator.hasMaxTenSpfRecords(spfRecords)).toBe(true);
		});
	});

	describe('checkDeprecatedMechanisms', () => {
		it('should return an empty array for SPF records without deprecated mechanisms', () => {
			const spfRecords: SpfRecordObject[] = [
				{ domain: 'example.com', spfRecord: 'v=spf1 include:_spf.google.com ~all', type: 'initial' as const },
			];
			expect(validator.checkDeprecatedMechanisms(spfRecords)).toEqual([]);
		});

		it('should return errors for SPF records with deprecated mechanisms', () => {
			const spfRecords: SpfRecordObject[] = [
				{ domain: 'example.com', spfRecord: 'v=spf1 ptr -all', type: 'initial' as const },
				{ domain: 'example.com', spfRecord: 'v=spf1 a ptr:example.com -all', type: 'initial' as const },
			];
			const errors = validator.checkDeprecatedMechanisms(spfRecords);
			expect(errors.length).toBe(2);
			expect(errors[0].error).toBe('Deprecated mechanism found: "ptr"');
			expect(errors[1].error).toBe('Deprecated mechanism found: "ptr"');
		});

		it('should not flag parts of other mechanisms', () => {
			const spfRecords: SpfRecordObject[] = [
				{ domain: 'example.com', spfRecord: 'v=spf1 a:optr.example.com -all', type: 'initial' as const },
			];
							expect(validator.checkDeprecatedMechanisms(spfRecords)).toEqual([]);
		});
	});

	describe('isPassAll', () => {
		it('should return an empty array for SPF records without "+all" or "all"', () => {
			const spfRecords: SpfRecordObject[] = [
				{ domain: 'example.com', spfRecord: 'v=spf1 -all', type: 'initial' as const },
				{ domain: 'example.com', spfRecord: 'v=spf1 ~all', type: 'initial' as const },
			];
			expect(validator.isPassAll(spfRecords)).toEqual([]);
		});

		it('should return errors for SPF records with "+all" or "all"', () => {
			const spfRecords: SpfRecordObject[] = [
				{ domain: 'example.com', spfRecord: 'v=spf1 +all', type: 'initial' as const },
				{ domain: 'example.com', spfRecord: 'v=spf1 all', type: 'initial' as const },
			];
			const errors = validator.isPassAll(spfRecords);
			expect(errors.length).toBe(2);
			expect(errors[0].error).toBe('Unsafe "+all" or "all" mechanism found');
			expect(errors[1].error).toBe('Unsafe "+all" or "all" mechanism found');
		});

		it('should correctly identify "all" or "+all" regardless of case', () => {
			const spfRecords: SpfRecordObject[] = [
				{ domain: 'example.com', spfRecord: 'v=spf1 ALL', type: 'initial' as const },
				{ domain: 'example.com', spfRecord: 'v=spf1 +ALL', type: 'initial' as const },
			];
			const errors = validator.isPassAll(spfRecords);
			expect(errors.length).toBe(2);
		});

		it('should not flag "-all" or "~all"', () => {
			const spfRecords: SpfRecordObject[] = [
				{ domain: 'example.com', spfRecord: 'v=spf1 -all', type: 'initial' as const },
				{ domain: 'example.com', spfRecord: 'v=spf1 ~all', type: 'initial' as const },
			];
			expect(validator.isPassAll(spfRecords)).toEqual([]);
		});
	});

	describe('getFirstAllQualifier', () => {
		it('should return the qualifier of the first "all" mechanism in the initial record', () => {
			const spfRecords: SpfRecordObject[] = [
				{ domain: 'example.com', spfRecord: 'v=spf1 include:_spf.google.com ~all', type: 'initial' as const },
				{ domain: '_spf.google.com', spfRecord: 'v=spf1 ip4:1.2.3.4 -all', type: 'include' as const },
			];
			expect(validator.getFirstAllQualifier(spfRecords)).toBe('~');
		});

		it('should return the qualifier of the first "all" mechanism in a redirect record', () => {
			const spfRecords: SpfRecordObject[] = [
				{ domain: 'example.com', spfRecord: 'v=spf1 redirect=_spf.google.com', type: 'initial' as const },
				{ domain: '_spf.google.com', spfRecord: 'v=spf1 ip4:1.2.3.4 -all', type: 'redirect' as const },
			];
			expect(validator.getFirstAllQualifier(spfRecords)).toBe('-');
		});

		it('should return "+" for an implicit qualifier', () => {
			const spfRecords: SpfRecordObject[] = [
				{ domain: 'example.com', spfRecord: 'v=spf1 all', type: 'initial' as const },
			];
			expect(validator.getFirstAllQualifier(spfRecords)).toBe('+');
		});

		it('should return null if no "all" mechanism is found', () => {
			const spfRecords: SpfRecordObject[] = [
				{ domain: 'example.com', spfRecord: 'v=spf1 include:_spf.google.com', type: 'initial' as const },
			];
			expect(validator.getFirstAllQualifier(spfRecords)).toBeNull();
		});

		it('should ignore "all" in include records', () => {
			const spfRecords: SpfRecordObject[] = [
				{ domain: 'example.com', spfRecord: 'v=spf1 include:_spf.google.com', type: 'initial' as const },
				{ domain: '_spf.google.com', spfRecord: 'v=spf1 -all', type: 'include' as const },
			];
			expect(validator.getFirstAllQualifier(spfRecords)).toBeNull();
		});
	});
});
