import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, UserSettings, ChatMessage, PromptSegment, DimensionKey } from '../../types';
import { AIProvider, TermExplanation, getApiKey, getCurrentModel } from './types';
import { getMasterAnalysisPrompt } from './masterPrompt';

// --- Schemas ---
const promptSegmentSchema = {
    type: Type.OBJECT,
    properties: {
        original: { type: Type.STRING, description: "The content in the requested Prompt Text language (e.g., English)." },
        translated: { type: Type.STRING, description: "The content translated into the requested Target Language (e.g., Chinese)." },
    },
    required: ["original", "translated"]
};

const analysisSchema = {
    type: Type.OBJECT,
    properties: {
        description: { type: Type.STRING, description: "A short, 1-sentence summary of the image content." },
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
    required: ["description", "structuredPrompts"],
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
        return JSON.parse(text) as AnalysisResult;
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

        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
        });

        const text = response.text;
        if (!text) throw new Error("No response from AI");
        return JSON.parse(text) as TermExplanation;
    }

    async chatStream(
        history: ChatMessage[],
        message: string,
        image: string | undefined,
        onUpdate: (text: string) => void,
        settings?: UserSettings
    ): Promise<void> {
        const { ai, modelName } = this.getClient();

        const historyParts = history.map(h => ({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: h.text }]
        }));

        let accumulatedText = "";
        let resultStream;

        const systemInstruction = `
      You are an AI assistant analyzing an image.
      If the user asks for specific prompts, prompt breakdown, or detailed analysis of the image:
      1. Provide **ONLY** the requested prompt text or description.
      2. Use the user's requested System Language: ${settings?.systemLanguage || 'English'}.
      3. Do **NOT** add conversational filler.
      4. Do **NOT** use markdown bolding (**) for the core prompt content.
      5. Be direct and technical.
    `;

        if (image) {
            const parts: any[] = [
                { inlineData: { mimeType: "image/jpeg", data: image.split(',')[1] } }
            ];

            let contextPrompt = "Chat History:\n";
            history.forEach(h => { contextPrompt += `${h.role}: ${h.text}\n`; });
            contextPrompt += `\nUser: ${message}`;
            parts.push({ text: contextPrompt });

            resultStream = await ai.models.generateContentStream({
                model: modelName,
                contents: { parts },
                config: { systemInstruction }
            });
        } else {
            const chat = ai.chats.create({
                model: modelName,
                history: historyParts as any,
                config: { systemInstruction }
            });
            resultStream = await chat.sendMessageStream({ message });
        }

        for await (const chunk of resultStream) {
            const chunkText = chunk.text;
            if (chunkText) {
                accumulatedText += chunkText;
                onUpdate(accumulatedText);
            }
        }
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

        const data = JSON.parse(response.text || "{}");
        return data.groups || [];
    }

    async regenerateDimension(base64Image: string, dimension: DimensionKey, settings: UserSettings): Promise<PromptSegment> {
        const { ai, modelName } = this.getClient();
        const { getDimensionPrompt } = await import('./masterPrompt');

        const response = await ai.models.generateContent({
            model: modelName,
            contents: {
                parts: [
                    { inlineData: { mimeType: "image/jpeg", data: base64Image.split(',')[1] } },
                    { text: getDimensionPrompt(dimension, settings) },
                ],
            },
            config: { responseMimeType: "application/json", responseSchema: promptSegmentSchema }
        });

        return JSON.parse(response.text || '{"original":"","translated":""}') as PromptSegment;
    }
}
