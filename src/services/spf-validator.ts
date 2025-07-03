export interface SpfRecordObject {
	domain: string;
	spfRecord: string;
	type: 'initial' | 'include' | 'redirect';
}

export class SpfValidator {
	/**
	 * Checks if any SPF record is present.
	 * @param spfRecords - An array of SpfRecordObject.
	 * @returns True if at least one SPF record is present, false otherwise.
	 */
	hasSpfRecord(spfRecords: SpfRecordObject[]): boolean {
		return spfRecords.length > 0;
	}

	/**
	 * Validates the syntax of all SPF records.
	 * A basic regex is used for validation.
	 * @param spfRecords - An array of SpfRecordObject.
	 * @returns An array of objects, each containing the record and an error message if syntax is invalid.
	 */
	validateSpfSyntax(spfRecords: SpfRecordObject[]): { record: SpfRecordObject; error: string }[] {
		const errors: { record: SpfRecordObject; error: string }[] = [];
		// Basic regex for SPF record validation. This is a simplified check.
		// A more robust validator would parse mechanisms and modifiers.
		const spfSyntaxRegex = /^v=spf1\s+([a-z0-9.:\-_/~+= ]+)?(all|~all|-all|\+all)$/;

		for (const record of spfRecords) {
			const trimmedRecord = record.spfRecord.trim();
			if (spfSyntaxRegex.test(trimmedRecord)) {
				continue;
			}

			if (!trimmedRecord.startsWith('v=spf1')) {
				errors.push({ record, error: 'Invalid SPF record syntax: must start with "v=spf1"' });
			} else if (/[~+-]?all"$/.test(trimmedRecord)) {
				errors.push({ record, error: 'Invalid SPF record syntax: trailing characters after the \'all\' mechanism' });
			} else if (!/(all|~all|-all|\+all)$/.test(trimmedRecord)) {
				errors.push({ record, error: 'Invalid SPF record syntax: must end with a valid \'all\' mechanism' });
			} else {
				// Fallback for other syntax errors not caught by specific checks
				errors.push({ record, error: `Invalid SPF record syntax: ${record.spfRecord}` });
			}
		}
		return errors;
	}

	/**
	 * Validates that there is exactly one "initial" SPF record.
	 * @param spfRecords - An array of SpfRecordObject.
	 * @returns True if exactly one initial SPF record is found, false otherwise.
	 */
	hasOneInitialSpfRecord(spfRecords: SpfRecordObject[]): boolean {
		const initialRecords = spfRecords.filter(record => record.type === 'initial');
		return initialRecords.length === 1;
	}

	/**
	 * Validates that the total number of SPF records (excluding "initial") is less than or equal to 10.
	 * This refers to the 10-lookup limit in SPF.
	 * @param spfRecords - An array of SpfRecordObject.
	 * @returns True if the number of non-initial SPF records is 10 or less, false otherwise.
	 */
	hasMaxTenSpfRecords(spfRecords: SpfRecordObject[]): boolean {
		const nonInitialRecords = spfRecords.filter(record => record.type !== 'initial');
		return nonInitialRecords.length <= 10;
	}

	/**
	 * Checks for deprecated mechanisms in SPF records, such as "ptr".
	 * @param spfRecords - An array of SpfRecordObject.
	 * @returns An array of objects, each containing the record and an error message if a deprecated mechanism is found.
	 */
	checkDeprecatedMechanisms(spfRecords: SpfRecordObject[]): { record: SpfRecordObject; error: string }[] {
		const errors: { record: SpfRecordObject; error: string }[] = [];
		const deprecatedMechanisms = ['ptr'];

		for (const record of spfRecords) {
			const parts = record.spfRecord.split(' ');
			for (const part of parts) {
				let mechanism = part;
				if (['+', '-', '~', '?'].includes(mechanism.charAt(0))) {
					mechanism = mechanism.substring(1);
				}

				for (const deprecated of deprecatedMechanisms) {
					if (mechanism === deprecated || mechanism.startsWith(deprecated + ':')) {
						errors.push({ record, error: `Deprecated mechanism found: "${deprecated}"` });
						break;
					}
				}
			}
		}
		return errors;
	}
}
