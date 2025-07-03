export interface SpfRecordObject {
	domain: string;
	spfRecord: string;
	type: 'initial' | 'include' | 'redirect';
}

class SyntaxValidator {
    validate(record: string): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];
        const terms = record.split(' ').filter(term => term.length > 0);

        if (terms.length === 0 || terms[0].toLowerCase() !== 'v=spf1') {
            errors.push('Record must start with "v=spf1"');
            return { isValid: false, errors };
        }

        const mechanisms = terms.slice(1);
        if (mechanisms.length === 0) {
            errors.push('Record must contain at least one mechanism or modifier');
            return { isValid: false, errors };
        }

        const lastTerm = mechanisms[mechanisms.length - 1];
        if (!lastTerm.includes('all') && !lastTerm.startsWith('redirect=')) {
            errors.push('Record must end with an "all" mechanism or a "redirect" modifier');
        }

        for (const term of mechanisms) {
            this.validateTerm(term, errors);
        }

        return { isValid: errors.length === 0, errors };
    }

    private validateTerm(term: string, errors: string[]): void {
        const qualifier = ['+', '-', '~', '?'].find(q => term.startsWith(q));
        const mechanism = qualifier ? term.substring(1) : term;

        const [name, value] = mechanism.split(/:(.*)/s);

        const knownMechanisms = ['a', 'mx', 'ip4', 'ip6', 'include', 'exists', 'all'];
        const knownModifiers = ['redirect', 'exp'];

        if (knownMechanisms.includes(name)) {
            this.validateMechanism(name, value, errors);
        } else if (knownModifiers.includes(name)) {
            this.validateModifier(name, value, errors);
        } else {
            errors.push(`Unknown mechanism or modifier: ${name}`);
        }
    }

    private validateMechanism(name: string, value: string | undefined, errors: string[]): void {
        if (['a', 'mx', 'include', 'exists'].includes(name) && !value) {
            errors.push(`Mechanism "${name}" requires a value`);
        }
        if (name === 'ip4' && value && !/^\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?$/.test(value)) {
            errors.push(`Invalid IPv4 address for "ip4": ${value}`);
        }
        if (name === 'ip6' && value && !/^[0-9a-fA-F:.]*$/.test(value)) {
            errors.push(`Invalid IPv6 address for "ip6": ${value}`);
        }
    }

    private validateModifier(name: string, value: string | undefined, errors: string[]): void {
        if (!value) {
            errors.push(`Modifier "${name}" requires a value`);
        }
    }
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
        const syntaxValidator = new SyntaxValidator();

		for (const record of spfRecords) {
			const validationResult = syntaxValidator.validate(record.spfRecord);
            if (!validationResult.isValid) {
                errors.push({ record, error: validationResult.errors.join(', ') });
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