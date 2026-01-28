
/**
 * Safely parse JSON string, attempting to fix common LLM formatting errors
 * like unescaped newlines, control characters, or extra text around JSON.
 */
export const safeParseJSON = <T>(jsonString: string, fallback: T): T => {
    if (!jsonString) return fallback;

    // 1. Try standard parse first (fastest path)
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        // Continue to repairs
    }

    // 2. Try to extract JSON from mixed content (e.g., "思考过程... {...}")
    try {
        const jsonObjectMatch = jsonString.match(/\{[\s\S]*\}/);
        if (jsonObjectMatch) {
            // Try parsing the extracted object directly
            try {
                return JSON.parse(jsonObjectMatch[0]);
            } catch {
                // Will try sanitizing below
            }
        }
        const jsonArrayMatch = jsonString.match(/\[[\s\S]*\]/);
        if (jsonArrayMatch) {
            return JSON.parse(jsonArrayMatch[0]);
        }
    } catch (e) {
        // Continue to next repair
    }

    // 3. Try to extract from markdown code blocks
    try {
        const codeBlockMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
            return JSON.parse(codeBlockMatch[1].trim());
        }
    } catch (e) {
        // Continue to next repair
    }

    // 4. Sanitize control characters and retry
    try {
        // First extract JSON if present
        const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
        const toSanitize = jsonMatch?.[0] || jsonString;

        // Remove or escape problematic control characters
        const sanitized = toSanitize
            // Remove all control characters except those in strings (simplified approach)
            .replace(/[\x00-\x1F\x7F]/g, (char) => {
                switch (char) {
                    case '\n': return '\\n';
                    case '\r': return '\\r';
                    case '\t': return '\\t';
                    default: return ''; // Remove other control characters
                }
            });

        return JSON.parse(sanitized);
    } catch (e) {
        // Continue to fallback
    }

    // 5. Aggressive cleanup: remove all non-essential characters
    try {
        const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            // Remove any potential trailing commas before } or ]
            const cleaned = jsonMatch[0]
                .replace(/,\s*([\}\]])/g, '$1')
                // Remove inline comments (non-standard but some LLMs add them)
                .replace(/\/\/[^\n]*/g, '')
                // Normalize whitespace
                .replace(/[\x00-\x1F\x7F]/g, ' ');

            return JSON.parse(cleaned);
        }
    } catch (e) {
        console.warn("JSON Parse (all attempts) failed:", e);
    }

    // 6. Last resort: Return fallback to prevent crash
    console.warn("Returning fallback for JSON:", jsonString.slice(0, 100) + "...");
    return fallback;
};
