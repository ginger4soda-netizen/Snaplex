import { AnalysisResult, UserSettings, ChatMessage, PromptSegment, DimensionKey } from '../../types';
import { AIProvider, TermExplanation, getApiKey, getCurrentModel } from './types';
import { getMasterAnalysisPrompt } from './masterPrompt';
import { safeParseJSON } from '../../utils/jsonParser';
import { getApiError, getGenericApiError } from '../../utils/apiErrorMessages';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export class OpenAIProvider implements AIProvider {

    readonly name = 'openai';

    private getHeaders(): HeadersInit {
        const apiKey = getApiKey('openai');
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

        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                model: modelName,
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'image_url', image_url: { url: imageData } },
                            { type: 'text', text: getMasterAnalysisPrompt(settings) }
                        ]
                    }
                ],
                response_format: { type: 'json_object' },
                max_tokens: 4000
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData.error?.message || '';

            if (response.status === 403 || errorMsg.includes("country") || errorMsg.includes("region")) {
                throw new Error(getApiError('regionRestricted'));
            }
            if (response.status === 401) {
                throw new Error(getApiError('invalidApiKey'));
            }
            if (response.status === 429 || errorMsg.includes("Rate limit") || errorMsg.includes("quota")) {
                throw new Error(getApiError('rateLimitExceeded'));
            }
            throw new Error(errorMsg || getGenericApiError('OpenAI', response.status));
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;
        if (!text) throw new Error("No response from OpenAI");
        return safeParseJSON(text, {} as AnalysisResult);
    }

    async explainTerm(term: string, language: string): Promise<TermExplanation> {
        const modelName = getCurrentModel();

        const prompt = `As an expert Art Director, explain the visual style/term: "${term}".
Target Language: ${language}
Rules: Keep it VERY concise.
"def": Definition (Max 100 words).
"app": Application (Max 100 words).
Output JSON: { "def": "...", "app": "..." }`;

        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                model: modelName,
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' },
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData.error?.message || '';

            if (response.status === 403) {
                throw new Error(getApiError('regionRestricted'));
            }
            if (response.status === 401) {
                throw new Error(getApiError('invalidApiKey'));
            }
            if (response.status === 429 || errorMsg.includes("Rate limit") || errorMsg.includes("quota")) {
                throw new Error(getApiError('rateLimitExceeded'));
            }
            throw new Error(errorMsg || getGenericApiError('OpenAI', response.status));
        }
        const data = await response.json();
        return safeParseJSON(data.choices?.[0]?.message?.content || '{}', { def: '', app: '' } as TermExplanation);
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

        const response = await fetch(OPENAI_API_URL, {
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
            if (response.status === 403) throw new Error("当前 VPN 节点所在的区域不支持当前模型。请尝试切换节点重试。");
            throw new Error(errorData.error?.message || `OpenAI stream error (${response.status})`);
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

        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                model: modelName,
                messages: [{
                    role: 'user',
                    content: `Analyze "${query}". Break into semantic concepts with synonyms.
Output JSON: { "groups": [ ["word1", "syn1", "syn2"], ["word2", "syn3"] ] }`
                }],
                response_format: { type: 'json_object' },
                max_tokens: 300
            })
        });

        if (!response.ok) return [];
        const data = await response.json();
        const parsed = safeParseJSON(data.choices?.[0]?.message?.content || '{}', { groups: [] });
        return parsed.groups || [];
    }

    async regenerateDimension(base64Image: string, dimension: DimensionKey, settings: UserSettings): Promise<PromptSegment> {
        console.time('⏱️ [Dimension] Total');
        const { getDimensionPrompt } = await import('./masterPrompt');
        const imageData = base64Image.includes(',') ? base64Image : `data:image/jpeg;base64,${base64Image}`;
        const modelName = getCurrentModel();

        console.time('⏱️ [Dimension] API call');
        const response = await fetch(OPENAI_API_URL, {
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
                            { type: 'text', text: "Analyze this image according to the instructions." }
                        ]
                    }
                ],
                response_format: { type: 'json_object' },
                max_tokens: 500
            })
        });
        console.timeEnd('⏱️ [Dimension] API call');

        if (!response.ok) {
            if (response.status === 403) throw new Error("当前 VPN 节点所在的区域不支持当前模型。请尝试切换节点重试。");
            throw new Error("OpenAI API error");
        }
        const data = await response.json();
        const { safeParseJSON } = await import('../../utils/jsonParser');
        const result = safeParseJSON(data.choices?.[0]?.message?.content || '{"original":"","translated":""}', { original: '', translated: '' });
        console.timeEnd('⏱️ [Dimension] Total');

        return { original: result.original || '', translated: result.translated || '' };
    }

    async translateText(text: string, language: string): Promise<string> {
        const { getTranslationPrompt } = await import('./masterPrompt');
        const modelName = getCurrentModel();

        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                model: modelName,
                messages: [{ role: 'user', content: getTranslationPrompt(text, language) }],
                response_format: { type: 'json_object' },
                max_tokens: 1000
            })
        });

        if (!response.ok) {
            if (response.status === 403) return "当前 VPN 节点所在的区域不支持当前模型。请尝试切换节点重试。";
            throw new Error("OpenAI Translation failed");
        }
        const data = await response.json();
        const result = safeParseJSON(data.choices?.[0]?.message?.content || '{"translated":""}', { translated: '' });
        return result.translated || '';
    }
}
