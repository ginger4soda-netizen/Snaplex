import { AnalysisResult, UserSettings, ChatMessage, PromptSegment, DimensionKey } from '../../types';
import { AIProvider, TermExplanation, getApiKey, getCurrentModel } from './types';
import { getMasterAnalysisPrompt } from './masterPrompt';
import { safeParseJSON } from '../../utils/jsonParser';

// SiliconFlow uses OpenAI-compatible API
const SILICONFLOW_API_URL = 'https://api.siliconflow.cn/v1/chat/completions';

export class SiliconFlowProvider implements AIProvider {
    readonly name = 'siliconflow';

    private getHeaders(): HeadersInit {
        const apiKey = getApiKey('siliconflow');
        // Defensive validation to prevent TypeError in fetch
        if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
            throw new Error("MISSING_API_KEY");
        }
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        };
    }

    async analyzeImage(base64Image: string, settings: UserSettings): Promise<AnalysisResult> {
        const modelName = getCurrentModel();
        const imageData = base64Image.includes(',') ? base64Image : `data:image/jpeg;base64,${base64Image}`;

        const response = await fetch(SILICONFLOW_API_URL, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                model: modelName,
                messages: [
                    {
                        role: 'system',
                        content: getMasterAnalysisPrompt(settings)
                    },
                    {
                        role: 'user',
                        content: [
                            { type: 'image_url', image_url: { url: imageData } },
                            { type: 'text', text: "Analyze this image according to the system instructions. Output STRICT JSON." }
                        ]
                    }
                ],
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'SiliconFlow API error');
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;
        if (!text) throw new Error("No response from SiliconFlow");

        // Extract JSON if wrapped in markdown and parse safely
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Invalid JSON response");
        return safeParseJSON(jsonMatch[0], {} as AnalysisResult);
    }

    async explainTerm(term: string, language: string): Promise<TermExplanation> {
        const modelName = getCurrentModel();

        const prompt = `As an expert Art Director, explain the visual style/term: "${term}".
Target Language: ${language}
Rules: Keep it VERY concise.
"def": Definition (Max 100 words).
"app": Application (Max 100 words).
Output JSON: { "def": "...", "app": "..." }`;

        const response = await fetch(SILICONFLOW_API_URL, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                model: modelName,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 200
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData.error?.message || errorData.message || `SiliconFlow API error (${response.status})`;
            throw new Error(errorMsg);
        }
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || '{}';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return safeParseJSON(jsonMatch?.[0] || '{}', { def: '', app: '' } as TermExplanation);
    }

    async chatStream(
        history: ChatMessage[],
        message: string,
        image: string | undefined,
        onUpdate: (text: string) => void,
        settings?: UserSettings
    ): Promise<void> {
        const modelName = getCurrentModel();
        const messages: any[] = [];

        // System message
        messages.push({
            role: 'system',
            content: `You are an AI assistant analyzing images. Use ${settings?.systemLanguage || 'English'}. Be direct and technical.`
        });

        // Build history with image in FIRST user message only
        let imageIncluded = false;
        const imageData = image?.includes(',') ? image : (image ? `data:image/jpeg;base64,${image}` : undefined);

        for (const h of history) {
            if (h.role === 'user' && imageData && !imageIncluded) {
                // First user message: include image
                messages.push({
                    role: 'user',
                    content: [
                        { type: 'image_url', image_url: { url: imageData } },
                        { type: 'text', text: h.text }
                    ]
                });
                imageIncluded = true;
            } else {
                messages.push({
                    role: h.role === 'user' ? 'user' : 'assistant',
                    content: h.text
                });
            }
        }

        // If no history yet but we have image, add it as first message
        if (imageData && !imageIncluded) {
            messages.push({
                role: 'user',
                content: [
                    { type: 'image_url', image_url: { url: imageData } },
                    { type: 'text', text: '[Image uploaded for analysis]' }
                ]
            });
            messages.push({ role: 'assistant', content: 'I can see the image. How can I help you analyze it?' });
        }

        // Current message (no image needed - it's in history)
        messages.push({ role: 'user', content: message });

        const response = await fetch(SILICONFLOW_API_URL, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                model: modelName,
                messages,
                stream: true
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData.error?.message || errorData.message || `SiliconFlow stream error (${response.status})`;
            throw new Error(errorMsg);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = "";

        if (reader) {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

                for (const line of lines) {
                    const data = line.slice(6);
                    if (data === '[DONE]') break;
                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices?.[0]?.delta?.content;
                        if (content) {
                            accumulatedText += content;
                            onUpdate(accumulatedText);
                        }
                    } catch { }
                }
            }
        }
    }

    async expandSearchQuery(query: string): Promise<string[][]> {
        const modelName = getCurrentModel();

        const response = await fetch(SILICONFLOW_API_URL, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                model: modelName,
                messages: [{
                    role: 'user',
                    content: `Analyze "${query}". Break into semantic concepts with synonyms.
Output JSON: { "groups": [ ["word1", "syn1", "syn2"], ["word2", "syn3"] ] }`
                }],
                max_tokens: 500
            })
        });

        if (!response.ok) return [];
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || '{}';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const parsed = safeParseJSON(jsonMatch?.[0] || '{}', { groups: [] });
        return parsed.groups || [];
    }

    async regenerateDimension(base64Image: string, dimension: DimensionKey, settings: UserSettings): Promise<PromptSegment> {
        console.time('⏱️ [Dimension] Total');

        console.time('⏱️ [Dimension] 1. Import prompt');
        const { getDimensionPrompt } = await import('./masterPrompt');
        console.timeEnd('⏱️ [Dimension] 1. Import prompt');

        const imageData = base64Image.includes(',') ? base64Image : `data:image/jpeg;base64,${base64Image}`;
        const modelName = getCurrentModel();
        console.log('⏱️ [Dimension] Using model:', modelName);

        // Determine format instruction based on dimension type
        const isTagBased = ['composition', 'lighting', 'mood', 'style'].includes(dimension);
        const formatInstruction = isTagBased
            ? "Return a comprehensive list of comma-separated TAGS (no sentences)."
            : "Return detailed, descriptive SENTENCES (at least 3 sentences).";

        // Construct robust user prompt to force adherence
        const userPrompt = `Analyze the [${dimension}] of this image. ${formatInstruction} Output STRICT JSON.`;

        console.time('⏱️ [Dimension] 2. API call');
        const response = await fetch(SILICONFLOW_API_URL, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                model: modelName,
                messages: [
                    {
                        role: 'system',
                        content: getDimensionPrompt(dimension, settings)
                    },
                    {
                        role: 'user',
                        content: [
                            { type: 'image_url', image_url: { url: imageData } },
                            { type: 'text', text: userPrompt }
                        ]
                    }
                ],
                max_tokens: 1000
            })
        });
        console.timeEnd('⏱️ [Dimension] 2. API call');

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData.error?.message || errorData.message || `SiliconFlow API error (${response.status})`;
            throw new Error(errorMsg);
        }

        console.time('⏱️ [Dimension] 3. Parse response');
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        console.log('⏱️ [Dimension] Raw response:', content.substring(0, 200));

        // Robust JSON parsing using utility
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch?.[0] || '{"original":"","translated":""}';
        const { safeParseJSON } = await import('../../utils/jsonParser');
        const result = safeParseJSON(jsonStr, { original: content, translated: '' });

        console.timeEnd('⏱️ [Dimension] Total');
        return { original: result.original || '', translated: result.translated || '' };
    }

    async translateText(text: string, language: string): Promise<string> {
        const { getTranslationPrompt } = await import('./masterPrompt');
        const modelName = getCurrentModel();

        const response = await fetch(SILICONFLOW_API_URL, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                model: modelName,
                messages: [{ role: 'user', content: getTranslationPrompt(text, language) }],
                max_tokens: 1000
            })
        });

        if (!response.ok) return '';
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '{"translated":""}';

        // Robust JSON parsing
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch?.[0] || '{"translated":""}';
        const result = safeParseJSON(jsonStr, { translated: '' });
        return result.translated || '';
    }
}
