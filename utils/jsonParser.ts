
/**
 * Safely parse JSON string, attempting to fix common LLM formatting errors
 * like unescaped newlines or control characters.
 */
export const safeParseJSON = <T>(jsonString: string, fallback: T): T => {
    if (!jsonString) return fallback;

    // 1. Try standard parse
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        // Continue to repairs
    }

    try {
        // 2. Fix unescaped newlines and tabs which are common in LLM output
        // We carefully only replace control characters that are NOT already escaped.
        // But JSON.parse expects \\n for \n.
        // A raw newline character (0x0A) invalidates JSON.
        // So we replace 0x0A with \n literal.
        const fixed = jsonString
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t');

        return JSON.parse(fixed);
    } catch (e) {
        console.warn("JSON Parse (Attempt 2) failed:", e);
    }

    // 3. Last resort: Try to sanitize aggressively if needed (e.g. remove non-printable)
    // For now, return fallback to prevent crash
    console.warn("Returning fallback for JSON:", jsonString.slice(0, 100) + "...");
    return fallback;
};
