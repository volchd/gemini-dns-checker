import { SpfRecordObject } from "../types";

class SyntaxValidator {
    validate(record: string): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];
        const terms = record.split(' ').filter(term => term.length > 0);

        if (terms.length === 0 || terms[0].toLowerCase() !== 'v=spf1') {
            errors.push('Record must start with "v=spf1"');
        }

        if (terms.length > 1) {
            const lastTerm = terms[terms.length - 1];
            if (!lastTerm.includes('all') && !lastTerm.startsWith('redirect=')) {
                errors.push('Record must end with an "all" mechanism or a "redirect" modifier');
            }
        }

        const mechanisms = terms.slice(1);
        if (mechanisms.length === 0) {
            errors.push('Record must contain at least one mechanism or modifier');
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
    private syntaxValidator = new SyntaxValidator();

    validate(spfRecords: SpfRecordObject[]): any[] {
        const results: any[] = [];

        if (!this.hasSpfRecord(spfRecords)) {
            results.push({ message: "No SPF record found." });
            return results;
        }

        results.push(...this.validateSpfSyntax(spfRecords));

        if (!this.hasOneInitialSpfRecord(spfRecords)) {
            results.push({ message: "There should be exactly one initial SPF record." });
        }

        if (!this.hasMaxTenSpfRecords(spfRecords)) {
            results.push({ message: "The number of SPF record lookups should not exceed 10." });
        }

        results.push(...this.checkDeprecatedMechanisms(spfRecords));
        results.push(...this.isPassAll(spfRecords));

        return results;
    }

	hasSpfRecord(spfRecords: SpfRecordObject[]): boolean {
		return spfRecords.length > 0;
	}

	validateSpfSyntax(spfRecords: SpfRecordObject[]): { record: SpfRecordObject; error: string }[] {
		const errors: { record: SpfRecordObject; error: string }[] = [];
		for (const record of spfRecords) {
			const validationResult = this.syntaxValidator.validate(record.spfRecord);
            if (!validationResult.isValid) {
                errors.push({ record, error: validationResult.errors.join(', ') });
            }
		}
		return errors;
	}

	hasOneInitialSpfRecord(spfRecords: SpfRecordObject[]): boolean {
		const initialRecords = spfRecords.filter(record => record.type === 'initial');
		return initialRecords.length === 1;
	}

	hasMaxTenSpfRecords(spfRecords: SpfRecordObject[]): boolean {
		const nonInitialRecords = spfRecords.filter(record => record.type !== 'initial');
		return nonInitialRecords.length <= 10;
	}

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

	isPassAll(spfRecords: SpfRecordObject[]): { record: SpfRecordObject; error: string }[] {
		const errors: { record: SpfRecordObject; error: string }[] = [];
		for (const record of spfRecords) {
			const terms = record.spfRecord.toLowerCase().split(' ').filter(term => term.length > 0);
			const lastTerm = terms[terms.length - 1];

			if (lastTerm === 'all' || lastTerm === '+all') {
				errors.push({ record, error: 'Unsafe "+all" or "all" mechanism found' });
			}
		}
		return errors;
	}

	getFirstAllQualifier(spfRecords: SpfRecordObject[]): string | null {
		for (const record of spfRecords) {
			if (record.type === 'initial' || record.type === 'redirect') {
				const terms = record.spfRecord.toLowerCase().split(' ').filter(term => term.length > 0);
				const allTerm = terms.find(term => term.endsWith('all'));

				if (allTerm) {
					if (allTerm === 'all') {
						return '+'; // Default qualifier
					}
					const qualifier = allTerm.charAt(0);
					if (['+', '-', '~', '?'].includes(qualifier)) {
						return qualifier;
					}
				}
			}
		}
		return null;
	}
}
