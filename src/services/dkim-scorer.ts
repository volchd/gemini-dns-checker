import { DkimRecordSet, DkimRecord, DkimScoreItem, DkimScoringResults } from "../types";
import { logger } from "../utils/logger";

export class DkimScorer {
    /**
     * Calculates a comprehensive score for DKIM records based on best practices
     * @param dkimRecordSet DKIM record set for the domain
     * @returns Scoring results with detailed breakdown
     */
    async calculateScore(dkimRecordSet: DkimRecordSet): Promise<DkimScoringResults> {
        const scoreItems: DkimScoreItem[] = [];
        const records = dkimRecordSet.records;

        // 1. DKIM Implemented (10 points)
        const implemented = records.length > 0;
        scoreItems.push({
            name: "DKIM Implemented",
            description: "At least one DKIM public key record is published for the domain.",
            score: implemented ? 10 : 0,
            maxScore: 10,
            passed: implemented,
            details: implemented ? `Found ${records.length} DKIM record(s)` : "No DKIM records found"
        });

        // 2. DKIM Key Length (up to 5 points)
        let keyLengthScore = 0;
        let maxKeyLength = 0;
        let hasWeakKey = false;
        const keyLengths: { selector: string; bits: number | null }[] = [];
        
        for (const record of records) {
            let bits: number | null = null;
            try {
                if (record.parsedData.publicKey) {
                    // Clean and normalize the key data
                    let keyData = record.parsedData.publicKey
                        .replace(/\s+/g, '')  // Remove all whitespace
                        .replace(/"+/g, '');  // Remove any quotes
                    
                    // Add padding if needed
                    while (keyData.length % 4) {
                        keyData += '=';
                    }

                    // Decode base64 to get the raw key bytes
                    const binary = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
                    logger.debug(`Decoded key length: ${binary.length} bytes for selector ${record.selector}`);

                    // Parse ASN.1 structure
                    let pos = 0;
                    
                    // All RSA keys start with a SEQUENCE
                    if (binary[pos++] !== 0x30) {
                        throw new Error('Not a valid RSA key (expected sequence)');
                    }
                    
                    // Get sequence length
                    let seqLength = binary[pos++];
                    if ((seqLength & 0x80) === 0x80) {
                        const lenBytes = seqLength & 0x7F;
                        seqLength = 0;
                        for (let i = 0; i < lenBytes; i++) {
                            seqLength = (seqLength << 8) | binary[pos++];
                        }
                    }

                    // Check if this is a SubjectPublicKeyInfo structure
                    const isSpki = binary[pos] === 0x30;
                    
                    if (isSpki) {
                        // Skip the AlgorithmIdentifier sequence
                        pos++; // Skip SEQUENCE tag
                        let algLength = binary[pos++];
                        if ((algLength & 0x80) === 0x80) {
                            const lenBytes = algLength & 0x7F;
                            pos += lenBytes + binary[pos];
                        } else {
                            pos += algLength;
                        }
                        
                        // Skip BIT STRING tag and length
                        if (binary[pos++] !== 0x03) {
                            throw new Error('Expected BIT STRING tag');
                        }
                        let bitStringLength = binary[pos++];
                        if ((bitStringLength & 0x80) === 0x80) {
                            const lenBytes = bitStringLength & 0x7F;
                            pos += lenBytes;
                        }
                        pos++; // Skip unused bits byte
                        
                        // Now we're at the start of the RSA key sequence
                        if (binary[pos++] !== 0x30) {
                            throw new Error('Expected RSA key sequence');
                        }
                        
                        // Skip the sequence length
                        let keySeqLength = binary[pos++];
                        if ((keySeqLength & 0x80) === 0x80) {
                            const lenBytes = keySeqLength & 0x7F;
                            pos += lenBytes;
                        }
                    }
                    
                    // Now we're at the modulus INTEGER tag
                    if (binary[pos++] !== 0x02) {
                        throw new Error('Expected INTEGER tag for modulus');
                    }
                    
                    // Get modulus length
                    let modulusLength = binary[pos++];
                    if ((modulusLength & 0x80) === 0x80) {
                        const lenBytes = modulusLength & 0x7F;
                        modulusLength = 0;
                        for (let i = 0; i < lenBytes; i++) {
                            modulusLength = (modulusLength << 8) | binary[pos++];
                        }
                    }
                    
                    // Skip leading zero if present (for non-negative integers)
                    if (binary[pos] === 0x00) {
                        modulusLength--;
                    }
                    
                    // Convert byte length to bit length
                    bits = modulusLength * 8;
                    logger.debug(`DKIM key length for selector ${record.selector}: ${bits} bits (${modulusLength} bytes)`);
                }
            } catch (error) {
                logger.warn(`Failed to determine key length for selector ${record.selector}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                bits = null;
            }
            
            keyLengths.push({ selector: record.selector, bits });
            if (bits !== null) {
                if (bits < 1024) hasWeakKey = true;
                if (bits > maxKeyLength) maxKeyLength = bits;
            }
        }
        
        if (hasWeakKey) {
            keyLengthScore = 0;
        } else if (maxKeyLength >= 2048) {
            keyLengthScore = 5;
        } else if (maxKeyLength >= 1024) {
            keyLengthScore = 3;
        }
        
        scoreItems.push({
            name: "DKIM Key Length",
            description: "Strength of DKIM keys in DNS: 2048-bit (or higher): 5 points. 1024-bit: 3 points. <1024-bit: 0.",
            score: keyLengthScore,
            maxScore: 5,
            passed: keyLengthScore > 0,
            details: keyLengths.map(k => `${k.selector}: ${k.bits ?? 'unknown'} bits`).join(", ")
        });

        // 3. DKIM Multiple Selectors (3 points)
        const multipleSelectors = records.length >= 2;
        scoreItems.push({
            name: "DKIM Multiple Selectors",
            description: "Domain has at least two DKIM selectors/keys set up (facilitates key rotation).",
            score: multipleSelectors ? 3 : 0,
            maxScore: 3,
            passed: multipleSelectors,
            details: multipleSelectors ? `Selectors: ${records.map(r => r.selector).join(", ")}` : "Only one selector found"
        });

        // 4. No DKIM Test Mode (2 points)
        const testModeSelectors = records.filter(r => Array.isArray(r.parsedData.flags) && r.parsedData.flags.includes('y')).map(r => r.selector);
        const noTestMode = testModeSelectors.length === 0;
        scoreItems.push({
            name: "No DKIM Test Mode",
            description: "DKIM DNS records are in normal mode (no t=y flags set, indicating no lingering test-mode).",
            score: noTestMode ? 2 : 0,
            maxScore: 2,
            passed: noTestMode,
            details: noTestMode ? "No test mode flags found" : `Test mode selectors: ${testModeSelectors.join(", ")}`
        });

        // Totals
        const totalScore = scoreItems.reduce((sum, item) => sum + item.score, 0);
        const maxPossibleScore = scoreItems.reduce((sum, item) => sum + item.maxScore, 0);
        const percentage = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;

        return {
            totalScore,
            maxPossibleScore,
            percentage,
            scoreItems
        };
    }
} 