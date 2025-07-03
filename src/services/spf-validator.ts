import { SpfRecordObject } from "../types";

/**
 * Validates the syntax of a single SPF record string.
 */
class SyntaxValidator {
    /**
     * Validates the overall syntax of an SPF record.
     * @param record The SPF record string to validate.
     * @returns An object indicating validity and a list of errors if any.
     */
    validate(record: string): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];
        // Split the record into terms and filter out empty strings.
        const terms = record.split(' ').filter(term => term.length > 0);

        // Check if the record starts with "v=spf1".
        if (terms.length === 0 || terms[0].toLowerCase() !== 'v=spf1') {
            errors.push('Record must start with "v=spf1"');
        }

        // Check if the record ends with an "all" mechanism or a "redirect" modifier.
        if (terms.length > 1) {
            const lastTerm = terms[terms.length - 1];
            if (!lastTerm.includes('all') && !lastTerm.startsWith('redirect=')) {
                errors.push('Record must end with an "all" mechanism or a "redirect" modifier');
            }
        }

        // Extract mechanisms and modifiers (terms after "v=spf1").
        const mechanisms = terms.slice(1);
        // Ensure there is at least one mechanism or modifier.
        if (mechanisms.length === 0) {
            errors.push('Record must contain at least one mechanism or modifier');
        }

        // Validate each term individually.
        for (const term of mechanisms) {
            this.validateTerm(term, errors);
        }

        // Return validity status and collected errors.
        return { isValid: errors.length === 0, errors };
    }

    /**
     * Validates an individual SPF record term (mechanism or modifier).
     * @param term The term string to validate.
     * @param errors The array to push validation errors into.
     */
    private validateTerm(term: string, errors: string[]): void {
        // Determine if the term has a qualifier (+, -, ~, ?).
        const qualifier = ['+', '-', '~', '?'].find(q => term.startsWith(q));
        // Extract the mechanism/modifier name by removing the qualifier if present.
        const mechanism = qualifier ? term.substring(1) : term;

        // Split the mechanism into name and value (e.g., "include:example.com" -> "include", "example.com").
        const [name, value] = mechanism.split(/:(.*)/s);

        // Define known SPF mechanisms and modifiers.
        const knownMechanisms = ['a', 'mx', 'ip4', 'ip6', 'include', 'exists', 'all'];
        const knownModifiers = ['redirect', 'exp'];

        // Validate based on whether it's a known mechanism or modifier.
        if (knownMechanisms.includes(name)) {
            this.validateMechanism(name, value, errors);
        } else if (knownModifiers.includes(name)) {
            this.validateModifier(name, value, errors);
        } else {
            // If neither, it's an unknown term.
            errors.push(`Unknown mechanism or modifier: ${name}`);
        }
    }

    /**
     * Validates specific rules for SPF mechanisms.
     * @param name The name of the mechanism (e.g., "a", "mx", "ip4").
     * @param value The value associated with the mechanism (e.g., IP address, domain).
     * @param errors The array to push validation errors into.
     */
    private validateMechanism(name: string, value: string | undefined, errors: string[]): void {
        // Check if mechanisms requiring a value have one.
        if (['a', 'mx', 'include', 'exists'].includes(name) && !value) {
            errors.push(`Mechanism "${name}" requires a value`);
        }
        // Validate IPv4 address format for "ip4" mechanism.
        if (name === 'ip4' && value && !/^\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?$/.test(value)) {
            errors.push(`Invalid IPv4 address for "ip4": ${value}`);
        }
        // Validate IPv6 address format for "ip6" mechanism.
        if (name === 'ip6' && value && !/^[0-9a-fA-F:.]*$/.test(value)) {
            errors.push(`Invalid IPv6 address for "ip6": ${value}`);
        }
    }

    /**
     * Validates specific rules for SPF modifiers.
     * @param name The name of the modifier (e.g., "redirect", "exp").
     * @param value The value associated with the modifier.
     * @param errors The array to push validation errors into.
     */
    private validateModifier(name: string, value: string | undefined, errors: string[]): void {
        // Check if modifiers require a value.
        if (!value) {
            errors.push(`Modifier "${name}" requires a value`);
        }
    }
}

/**
 * Provides comprehensive SPF record validation, including syntax, quantity, and best practices.
 */
export class SpfValidator {
    private syntaxValidator = new SyntaxValidator();

    /**
     * Validates a list of SPF record objects against various rules and best practices.
     * @param spfRecords An array of SpfRecordObject to validate.
     * @returns An array of validation results, including messages for issues found.
     */
    validate(spfRecords: SpfRecordObject[]): any[] {
        const results: any[] = [];

        // Check if any SPF record exists.
        if (!this.hasSpfRecord(spfRecords)) {
            results.push({ message: "No SPF record found." });
            return results;
        }

        // Validate the syntax of each SPF record.
        results.push(...this.validateSpfSyntax(spfRecords));

        // Check for exactly one initial SPF record.
        if (!this.hasOneInitialSpfRecord(spfRecords)) {
            results.push({ message: "There should be exactly one initial SPF record." });
        }

        // Check for the maximum number of SPF record lookups.
        if (!this.hasMaxTenSpfRecords(spfRecords)) {
            results.push({ message: "The number of SPF record lookups should not exceed 10." });
        }

        // Check for deprecated mechanisms.
        results.push(...this.checkDeprecatedMechanisms(spfRecords));
        // Check for unsafe "+all" or "all" mechanisms.
        results.push(...this.isPassAll(spfRecords));

        return results;
    }

    /**
     * Checks if there is at least one SPF record in the provided list.
     * @param spfRecords An array of SpfRecordObject.
     * @returns True if at least one SPF record exists, false otherwise.
     */
	hasSpfRecord(spfRecords: SpfRecordObject[]): boolean {
		return spfRecords.length > 0;
	}

    /**
     * Validates the syntax of each SPF record using the SyntaxValidator.
     * @param spfRecords An array of SpfRecordObject.
     * @returns An array of errors found during syntax validation.
     */
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

    /**
     * Checks if there is exactly one initial SPF record.
     * @param spfRecords An array of SpfRecordObject.
     * @returns True if there is exactly one initial SPF record, false otherwise.
     */
	hasOneInitialSpfRecord(spfRecords: SpfRecordObject[]): boolean {
		const initialRecords = spfRecords.filter(record => record.type === 'initial');
		return initialRecords.length === 1;
	}

    /**
     * Checks if the number of SPF record lookups (non-initial records) does not exceed 10.
     * @param spfRecords An array of SpfRecordObject.
     * @returns True if the number of non-initial SPF records is 10 or less, false otherwise.
     */
	hasMaxTenSpfRecords(spfRecords: SpfRecordObject[]): boolean {
		const nonInitialRecords = spfRecords.filter(record => record.type !== 'initial');
		return nonInitialRecords.length <= 10;
	}

    /**
     * Checks for the presence of deprecated SPF mechanisms (e.g., "ptr").
     * @param spfRecords An array of SpfRecordObject.
     * @returns An array of errors if deprecated mechanisms are found.
     */
	checkDeprecatedMechanisms(spfRecords: SpfRecordObject[]): { record: SpfRecordObject; error: string }[] {
		const errors: { record: SpfRecordObject; error: string }[] = [];
		const deprecatedMechanisms = ['ptr'];

		for (const record of spfRecords) {
			const parts = record.spfRecord.split(' ');
			for (const part of parts) {
				let mechanism = part;
				// Remove qualifier if present.
				if (['+', '-', '~', '?'].includes(mechanism.charAt(0))) {
					mechanism = mechanism.substring(1);
				}

				// Check against deprecated mechanisms.
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

    /**
     * Checks if any SPF record uses the unsafe "+all" or "all" mechanism.
     * @param spfRecords An array of SpfRecordObject.
     * @returns An array of errors if unsafe "all" mechanisms are found.
     */
	isPassAll(spfRecords: SpfRecordObject[]): { record: SpfRecordObject; error: string }[] {
		const errors: { record: SpfRecordObject; error: string }[] = [];
		for (const record of spfRecords) {
			// Convert to lowercase and split into terms.
			const terms = record.spfRecord.toLowerCase().split(' ').filter(term => term.length > 0);
			const lastTerm = terms[terms.length - 1];

			// If the last term is "all" or "+all", it's considered unsafe.
			if (lastTerm === 'all' || lastTerm === '+all') {
				errors.push({ record, error: 'Unsafe "+all" or "all" mechanism found' });
			}
		}
		return errors;
	}

    /**
     * Retrieves the qualifier of the first "all" mechanism found in the initial or redirected SPF records.
     * @param spfRecords An array of SpfRecordObject.
     * @returns The qualifier (e.g., "+", "-", "~", "?") or null if not found.
     */
	getFirstAllQualifier(spfRecords: SpfRecordObject[]): string | null {
		for (const record of spfRecords) {
			// Only consider initial or redirect records.
			if (record.type === 'initial' || record.type === 'redirect') {
				// Convert to lowercase and split into terms.
				const terms = record.spfRecord.toLowerCase().split(' ').filter(term => term.length > 0);
				// Find the term ending with "all".
				const allTerm = terms.find(term => term.endsWith('all'));

				if (allTerm) {
					// If it's just "all", default qualifier is "+".
					if (allTerm === 'all') {
						return '+'; // Default qualifier
					}
					// Extract and return the qualifier if it's one of the known qualifiers.
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
