import { SpfRecordObject, SpfValidationResults } from "../types";
import { SpfScorer } from "./spf-scorer";
import ipaddr from 'ipaddr.js';
import { logger } from "../utils/logger";

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
        logger.debug(`Validating SPF record syntax: ${record}`);
        const errors: string[] = [];
        // Split the record into terms and filter out empty strings.
        const terms = record.split(' ').filter(term => term.length > 0);
        logger.debug(`SPF terms to validate: ${terms.join(', ')}`);

        // Check if the record starts with "v=spf1".
        if (terms.length === 0 || terms[0].toLowerCase() !== 'v=spf1') {
            logger.debug('SPF validation failed: Missing or invalid version');
            errors.push('Record must start with "v=spf1"');
        }

        // Check if the record ends with an "all" mechanism or a "redirect" modifier.
        if (terms.length > 1) {
            const lastTerm = terms[terms.length - 1];
            if (!lastTerm.includes('all') && !lastTerm.startsWith('redirect=')) {
                logger.debug(`SPF validation failed: Invalid last term "${lastTerm}"`);
                errors.push('Record must end with an "all" mechanism or a "redirect" modifier');
            }
        }

        // Extract mechanisms and modifiers (terms after "v=spf1").
        const mechanisms = terms.slice(1);
        // Ensure there is at least one mechanism or modifier.
        if (mechanisms.length === 0) {
            logger.debug('SPF validation failed: No mechanisms found');
            errors.push('Record must contain at least one mechanism or modifier');
        }

        // Validate each term individually.
        for (const term of mechanisms) {
            logger.debug(`Validating SPF term: ${term}`);
            this.validateTerm(term, errors);
        }

        // Return validity status and collected errors.
        const isValid = errors.length === 0;
        logger.debug(`SPF syntax validation complete. Valid: ${isValid}, Errors: ${errors.length}`);
        return { isValid, errors };
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

        // Define known SPF mechanisms and modifiers.
        const knownMechanisms = ['a', 'mx', 'ip4', 'ip6', 'ptr', 'include', 'exists', 'all'];
        const knownModifiers = ['redirect', 'exp'];

        // Split the mechanism into name and value.
        let name: string, value: string | undefined;
        if (knownModifiers.some(mod => mechanism.startsWith(mod + '='))) {
            // For modifiers, use '=' as separator.
            [name, value] = mechanism.split(/=(.*)/s);
        } else {
            // For mechanisms, use ':' as separator.
            [name, value] = mechanism.split(/:(.*)/s);
        }

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
        logger.debug(`Validating SPF mechanism: ${name}${value ? `:${value}` : ''}`);
        
        // Check if mechanisms requiring a value have one.
        if (['include', 'exists'].includes(name) && !value) {
            logger.debug(`SPF mechanism "${name}" missing required value`);
            errors.push(`Mechanism "${name}" requires a value`);
        }
        // Validate IPv4 address format for "ip4" mechanism.
        if (name === 'ip4' && value && !this.isValidIp4(value)) {
            logger.debug(`Invalid IPv4 address in SPF: ${value}`);
            errors.push(`Invalid IPv4 address for "ip4": ${value}`);
        }
        // Validate IPv6 address format for "ip6" mechanism.
        if (name === 'ip6' && value && !this.isValidateIp6(value)) {
            logger.debug(`Invalid IPv6 address in SPF: ${value}`);
            errors.push(`Invalid IPv6 address for "ip6": ${value}`);
        }
    }

    /**
     * Validate an SPF ip4 mechanism.
     * @param value  The literal after "ip4:", e.g. "192.168.1.1" or "192.168.1.0/24"
     * @returns      true  → syntactically valid
     *               false → invalid
     */
    private isValidIp4(value: string): boolean {
        const parts = value.split('/');
        const ip = parts[0];
        const cidr = parts[1];

        // Validate IP address format and octets
        const octets = ip.split('.');
        if (octets.length !== 4) {
            return false;
        }

        for (const octet of octets) {
            const num = parseInt(octet, 10);
            if (isNaN(num) || num < 0 || num > 255) {
                return false;
            }
        }

        // Validate CIDR if present
        if (cidr !== undefined) {
            const cidrNum = parseInt(cidr, 10);
            if (isNaN(cidrNum) || cidrNum < 0 || cidrNum > 32) {
                return false;
            }
        }

        return true;
    }

    /**
     * Validate an SPF ip6 mechanism.
     * @param value  The literal after "ip6:", e.g. "2800:3f0:4000::/36"
     * @returns      true  → syntactically valid
     *               false → invalid (an explanatory message is logged)
     */
    private isValidateIp6(value: string): boolean {
        const [addr, cidr] = value.split("/");

        /* 1 — basic IPv6 syntax */
        if (!ipaddr.isValid(addr) || ipaddr.parse(addr).kind() !== "ipv6") {
            console.error(`Invalid IPv6 address: ${addr}`);
            return false;
        }

        /* 2 — optional CIDR prefix 0-128 */
        if (cidr !== undefined) {
            const n = Number(cidr);
            if (!Number.isInteger(n) || n < 0 || n > 128) {
                console.error(`CIDR length must be 0–128 (got ${cidr})`);
                return false;
            }
        }

        return true;          // everything checks out
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
    private scorer = new SpfScorer();

    /**
     * Validates a list of SPF record objects against various rules and best practices.
     * @param spfRecords An array of SpfRecordObject to validate.
     * @returns An array of validation results, including messages for issues found.
     */
    validate(spfRecords: SpfRecordObject[]): SpfValidationResults {
        logger.debug(`Starting SPF validation for ${spfRecords.length} records`);
        
        const results: SpfValidationResults = {
            hasSpfRecord: { isValid: false },
            syntaxValidation: { isValid: false, errors: [] },
            oneInitialSpfRecord: { isValid: false },
            maxTenSpfRecords: { isValid: false },
            deprecatedMechanisms: { isValid: false, errors: [] },
            unsafeAllMechanism: { isValid: false, errors: [] },
            firstAllQualifier: { qualifier: null }
        };

        // Concatenate split SPF records before validation
        spfRecords.forEach(record => {
            logger.debug(`Processing SPF record for domain: ${record.domain}, type: ${record.type}`);
            record.spfRecord = this.concatenateSpfRecordString(record.spfRecord);
        });

        logger.debug("Concatenated SPF records:", spfRecords.map(r => ({ domain: r.domain, record: r.spfRecord })));

        // 1. Check if any SPF record exists.
        const hasRecord = this.hasSpfRecord(spfRecords);
        results.hasSpfRecord.isValid = hasRecord;
        logger.debug(`SPF record existence check: ${hasRecord}`);
        if (!hasRecord) {
            results.hasSpfRecord.message = "No SPF record found.";
            logger.debug("Validation stopped: No SPF records found");
            return results;
        }

        // 2. Validate the syntax of each SPF record.
        const syntaxErrors = this.validateSpfSyntax(spfRecords);
        results.syntaxValidation.isValid = syntaxErrors.length === 0;
        results.syntaxValidation.errors = syntaxErrors;
        logger.debug(`SPF syntax validation complete. Valid: ${results.syntaxValidation.isValid}, Errors: ${syntaxErrors.length}`);

        // 3. Check for exactly one initial SPF record.
        const hasOneInitial = this.hasOneInitialSpfRecord(spfRecords);
        results.oneInitialSpfRecord.isValid = hasOneInitial;
        logger.debug(`Single initial SPF record check: ${hasOneInitial}`);
        if (!hasOneInitial) {
            results.oneInitialSpfRecord.message = "There should be exactly one initial SPF record.";
        }

        // 4. Check for the maximum number of SPF record lookups.
        const hasMaxTen = this.hasMaxTenSpfRecords(spfRecords);
        results.maxTenSpfRecords.isValid = hasMaxTen;
        logger.debug(`Maximum SPF lookups check: ${hasMaxTen}`);
        if (!hasMaxTen) {
            results.maxTenSpfRecords.message = "The number of SPF record lookups should not exceed 10.";
        }

        // 5. Check for deprecated mechanisms.
        const deprecatedErrors = this.checkDeprecatedMechanisms(spfRecords);
        results.deprecatedMechanisms.isValid = deprecatedErrors.length === 0;
        results.deprecatedMechanisms.errors = deprecatedErrors;
        logger.debug(`Deprecated mechanisms check complete. Valid: ${results.deprecatedMechanisms.isValid}, Errors: ${deprecatedErrors.length}`);

        // 6. Check for unsafe "+all" or "all" mechanisms.
        const unsafeAllErrors = this.isPassAll(spfRecords);
        results.unsafeAllMechanism.isValid = unsafeAllErrors.length === 0;
        results.unsafeAllMechanism.errors = unsafeAllErrors;
        logger.debug(`Unsafe "all" mechanism check complete. Valid: ${results.unsafeAllMechanism.isValid}`);

        // 7. Get the qualifier of the first "all" mechanism.
        const qualifier = this.getFirstAllQualifier(spfRecords);
        results.firstAllQualifier.qualifier = qualifier;
        logger.debug(`First "all" qualifier found: ${qualifier || 'none'}`);
        if (!qualifier) {
            results.firstAllQualifier.message = "No 'all' mechanism found in initial or redirect records.";
        }

        logger.debug("SPF validation complete", results);
        return results;
    }

    /**
     * Validates SPF records and returns both validation results and scoring
     * @param spfRecords An array of SpfRecordObject to validate.
     * @returns Object containing validation results and scoring results
     */
    validateWithScoring(spfRecords: SpfRecordObject[]): {
        validationResults: SpfValidationResults;
        scoringResults: ReturnType<SpfScorer['calculateScore']>;
    } {
        const validationResults = this.validate(spfRecords);
        const scoringResults = this.scorer.calculateScore(spfRecords, validationResults);
        
        return {
            validationResults,
            scoringResults
        };
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

    /**
     * Concatenates a split SPF record string into a single string.
     * @param splitRecordString The SPF record string that might be split into multiple quoted segments.
     * @returns The concatenated SPF record string.
     */
    private concatenateSpfRecordString(splitRecordString: string): string {
        const regex = /"([^"]*)"/g;
        let match;
        const segments: string[] = [];

        while ((match = regex.exec(splitRecordString)) !== null) {
            segments.push(match[1]);
        }
        
        // If no quoted segments found, return the original string
        if (segments.length === 0) {
            return splitRecordString;
        }
        
        return segments.join('');
    }
}
