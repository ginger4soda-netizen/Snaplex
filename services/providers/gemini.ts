import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, UserSettings, ChatMessage, PromptSegment, DimensionKey } from '../../types';
import { AIProvider, TermExplanation, getApiKey, getCurrentModel } from './types';
import { getMasterAnalysisPrompt } from './masterPrompt';
import { safeParseJSON } from '../../utils/jsonParser';
import { getApiError } from '../../utils/apiErrorMessages';

// --- Schemas ---
// Schema for initial analysis (requires both original and translated)
const promptSegmentSchema = {
    type: Type.OBJECT,
    properties: {
        original: { type: Type.STRING, description: "The content in the requested Prompt Text language (e.g., English)." },
        translated: { type: Type.STRING, description: "The content translated into the requested Target Language (e.g., Chinese)." },
    },
    required: ["original", "translated"]
};

// Schema for dimension regeneration (original only - translation done lazily)
const originalOnlySchema = {
    type: Type.OBJECT,
    properties: {
        original: { type: Type.STRING, description: "The content in the requested output language." },
    },
    required: ["original"]
};

const analysisSchema = {
    type: Type.OBJECT,
    properties: {
        structuredPrompts: {
            type: Type.OBJECT,
            properties: {
                subject: promptSegmentSchema,
                environment: promptSegmentSchema,
                composition: promptSegmentSchema,
                lighting: promptSegmentSchema,
                mood: promptSegmentSchema,
                style: promptSegmentSchema,
            }
        },
    },
    required: ["structuredPrompts"],
};

export class GeminiProvider implements AIProvider {

    readonly name = 'gemini';

    private getClient() {
        const apiKey = getApiKey('gemini');
        if (!apiKey) throw new Error("MISSING_API_KEY");
        const modelName = getCurrentModel();
        const ai = new GoogleGenAI({ apiKey });
        return { ai, modelName };
    }

    async analyzeImage(base64Image: string, settings: UserSettings): Promise<AnalysisResult> {
        const { ai, modelName } = this.getClient();

        try {
            const response = await ai.models.generateContent({
                model: modelName,
                contents: {
                    parts: [
                        { inlineData: { mimeType: "image/jpeg", data: base64Image.split(',')[1] } },
                        { text: getMasterAnalysisPrompt(settings) },
                    ],
                },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: analysisSchema,
                },
            });

            const text = response.text;
            if (!text) throw new Error("No response from Gemini");
            return safeParseJSON(text, {} as AnalysisResult);

        } catch (error: any) {
            // Handle 429 Rate Limit
            if (error.status === 429 || error.message?.includes("quota") || error.message?.includes("rate") || error.message?.includes("配额")) {
                throw new Error(getApiError('rateLimitExceeded'));
            }
            // Handle 401 Unauthorized
            if (error.status === 401 || error.message?.includes("API key")) {
                throw new Error(getApiError('invalidApiKey'));
            }
            // Handle region restrictions
            if (error.message?.includes("User location") || error.message?.includes("400") || error.status === 400) {
                throw new Error(getApiError('regionRestricted'));
            }
            throw error;
        }
    }

    async explainTerm(term: string, language: string): Promise<TermExplanation> {
        const { ai, modelName } = this.getClient();

        const prompt = `As an expert Art Director, explain the visual style/term: "${term}".
      
Target Language: ${language} (Must output in this language)

Rules:
1. Keep it VERY concise (for a small screen).
2. "def": Definition/Characteristics (Max 80 words).
3. "app": Common usage/Application (Max 80 words).

Output strictly JSON:
{ "def": "...", "app": "..." }`;

        try {
            const response = await ai.models.generateContent({
                model: modelName,
                contents: [{ parts: [{ text: prompt }] }],
                config: { responseMimeType: "application/json" }
            });

            const text = response.text;
            if (!text) throw new Error("No response from AI");
            return safeParseJSON(text, { def: '', app: '' } as TermExplanation);
        } catch (error: any) {
            if (error.status === 429 || error.message?.includes("quota") || error.message?.includes("rate") || error.message?.includes("配额")) {
                throw new Error(getApiError('rateLimitExceeded'));
            }
            if (error.status === 401 || error.message?.includes("API key")) {
                throw new Error(getApiError('invalidApiKey'));
            }
            if (error.message?.includes("User location") || error.message?.includes("400") || error.status === 400) {
                throw new Error(getApiError('regionRestricted'));
            }
            throw error;
        }
    }

    async chatStream(
        history: ChatMessage[],
        message: string,
        image: string | undefined,
        onUpdate: (text: string) => void,
        settings?: UserSettings
    ): Promise<void> {
        console.time('⏱️ [Chat] Total');
        console.time('⏱️ [Chat] 1. getClient');
        const { ai, modelName } = this.getClient();
        console.timeEnd('⏱️ [Chat] 1. getClient');

        const systemInstruction = `You are an AI assistant analyzing an image.
If the user asks for specific prompts, prompt breakdown, or detailed analysis of the image:
1. Provide **ONLY** the requested prompt text or description.
2. Use the user's requested System Language: ${settings?.systemLanguage || 'English'}.
3. Do **NOT** add conversational filler.
4. Do **NOT** use markdown bolding (**) for the core prompt content.
5. Be direct and technical.`;

        console.time('⏱️ [Chat] 2. Build history');
        // Build history with image in FIRST user message only
        const historyParts: any[] = [];
        let imageIncluded = false;

        for (const h of history) {
            if (h.role === 'user' && image && !imageIncluded) {
                // First user message: include image
                historyParts.push({
                    role: 'user',
                    parts: [
                        { inlineData: { mimeType: 'image/jpeg', data: image.split(',')[1] } },
                        { text: h.text }
                    ]
                });
                imageIncluded = true;
            } else {
                historyParts.push({
                    role: h.role === 'user' ? 'user' : 'model',
                    parts: [{ text: h.text }]
                });
            }
        }

        // If no history yet but we have image, add it as context
        if (image && !imageIncluded && historyParts.length === 0) {
            historyParts.push({
                role: 'user',
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: image.split(',')[1] } },
                    { text: '[Image uploaded for analysis]' }
                ]
            });
            historyParts.push({
                role: 'model',
                parts: [{ text: 'I can see the image. How can I help you analyze it?' }]
            });
        }
        console.timeEnd('⏱️ [Chat] 2. Build history');
        console.log('⏱️ [Chat] History length:', historyParts.length, 'Image included:', imageIncluded);

        console.time('⏱️ [Chat] 3. Create chat session');
        // Create chat session with history
        const chat = ai.chats.create({
            model: modelName,
            history: historyParts,
            config: { systemInstruction }
        });
        console.timeEnd('⏱️ [Chat] 3. Create chat session');

        console.time('⏱️ [Chat] 4. sendMessageStream (await)');
        // Send current message (no image needed - it's in history)
        let resultStream;
        try {
            resultStream = await chat.sendMessageStream({ message });
        } catch (error: any) {
            if (error.message?.includes("User location") || error.message?.includes("400") || error.status === 400) {
                throw new Error("当前 VPN 节点所在的区域不支持当前模型。请尝试切换节点重试。");
            }
            throw error;
        }
        console.timeEnd('⏱️ [Chat] 4. sendMessageStream (await)');

        console.time('⏱️ [Chat] 5. Stream chunks');
        let accumulatedText = "";
        let chunkCount = 0;
        for await (const chunk of resultStream) {
            const chunkText = chunk.text;
            if (chunkText) {
                chunkCount++;
                accumulatedText += chunkText;
                onUpdate(accumulatedText);
            }
        }
        console.timeEnd('⏱️ [Chat] 5. Stream chunks');
        console.log('⏱️ [Chat] Received', chunkCount, 'chunks');
        console.timeEnd('⏱️ [Chat] Total');
    }

    async expandSearchQuery(query: string): Promise<string[][]> {
        const { ai, modelName } = this.getClient();

        const response = await ai.models.generateContent({
            model: modelName,
            contents: {
                parts: [{
                    text: `Analyze the search query: "${query}". 
Break it down into distinct semantic concepts (keywords). 
For each concept, provide the original word and 3 relevant synonyms or visual descriptors.

Output STRICT JSON format ONLY:
{ "groups": [ ["originalWord1", "synonymA", "synonymB"], ["originalWord2", "synonymC"] ] }

Example: "Rainy Street" -> { "groups": [ ["Rainy", "Wet", "Storm", "Drizzle"], ["Street", "Road", "Alley", "Lane"] ] }`
                }]
            },
            config: { responseMimeType: "application/json" }
        });

        const data = safeParseJSON(response.text || "{}", { groups: [] });
        return data.groups || [];
    }

    async regenerateDimension(base64Image: string, dimension: DimensionKey, settings: UserSettings): Promise<PromptSegment> {
        console.time('⏱️ [Dimension] Total');
        console.time('⏱️ [Dimension] 1. getClient');
        const { ai, modelName } = this.getClient();
        console.timeEnd('⏱️ [Dimension] 1. getClient');

        console.time('⏱️ [Dimension] 2. import prompt');
        const { getDimensionPrompt } = await import('./masterPrompt');
        console.timeEnd('⏱️ [Dimension] 2. import prompt');

        console.time('⏱️ [Dimension] 3. API call');
        try {
            const response = await ai.models.generateContent({
                model: modelName,
                contents: {
                    parts: [
                        { inlineData: { mimeType: "image/jpeg", data: base64Image.split(',')[1] } },
                        { text: "Analyze this image according to the system instructions." },
                    ],
                },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: promptSegmentSchema,
                    systemInstruction: getDimensionPrompt(dimension, settings)
                }
            });
            console.timeEnd('⏱️ [Dimension] 3. API call');

            console.time('⏱️ [Dimension] 4. Parse result');
            const { safeParseJSON } = await import('../../utils/jsonParser');
            const result = safeParseJSON(response.text || '{"original":"","translated":""}', { original: '', translated: '' });
            console.timeEnd('⏱️ [Dimension] 4. Parse result');
            console.timeEnd('⏱️ [Dimension] Total');

            return { original: result.original || '', translated: result.translated || '' };
        } catch (error: any) {
            if (error.message?.includes("User location") || error.message?.includes("400") || error.status === 400) {
                throw new Error("当前 VPN 节点所在的区域不支持当前模型。请尝试切换节点重试。");
            }
            throw error;
        }
    }

    async translateText(text: string, language: string): Promise<string> {
        const { getTranslationPrompt } = await import('./masterPrompt');
        const { ai, modelName } = this.getClient();

        try {
            const response = await ai.models.generateContent({
                model: modelName,
                contents: {
                    parts: [{ text: getTranslationPrompt(text, language) }]
                },
                config: { responseMimeType: "application/json" }
            });

            const result = safeParseJSON(response.text || '{"translated":""}', { translated: '' });
            return result.translated || '';
        } catch (error: any) {
            if (error.message?.includes("User location") || error.message?.includes("400") || error.status === 400) {
                throw new Error("当前 VPN 节点所在的区域不支持当前模型。请尝试切换节点重试。");
            }
            throw error;
        }
    }
}
