import { AnalysisResult, UserSettings, ChatMessage, PromptSegment, DimensionKey } from '../../types';
import { AIProvider, TermExplanation, getApiKey, getCurrentModel } from './types';
import { getMasterAnalysisPrompt } from './masterPrompt';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

export class ClaudeProvider implements AIProvider {

    readonly name = 'claude';

    private getHeaders() {
        const apiKey = getApiKey('claude');
        if (!apiKey) throw new Error("MISSING_API_KEY");
        return {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        };
    }

    async analyzeImage(base64Image: string, settings: UserSettings): Promise<AnalysisResult> {
        const modelName = getCurrentModel();
        const imageData = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

        const response = await fetch(CLAUDE_API_URL, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                model: modelName,
                max_tokens: 2000,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'image',
                                source: { type: 'base64', media_type: 'image/jpeg', data: imageData }
                            },
                            { type: 'text', text: getMasterAnalysisPrompt(settings) }
                        ]
                    }
                ]
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Claude API error');
        }

        const data = await response.json();
        const text = data.content?.[0]?.text;
        if (!text) throw new Error("No response from Claude");

        // Claude may wrap JSON in markdown, so extract it
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Invalid JSON response from Claude");
        return JSON.parse(jsonMatch[0]) as AnalysisResult;
    }

    async explainTerm(term: string, language: string): Promise<TermExplanation> {
        const modelName = getCurrentModel();

        const prompt = `As an expert Art Director, explain the visual style/term: "${term}".
Target Language: ${language}
Rules: Keep it VERY concise.
"def": Definition (Max 80 words).
"app": Application (Max 80 words).
Output JSON only (no markdown): { "def": "...", "app": "..." }`;

        const response = await fetch(CLAUDE_API_URL, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                model: modelName,
                max_tokens: 1000,
                messages: [{ role: 'user', content: prompt }]
            })
        });

        if (!response.ok) throw new Error("Claude API error");
        const data = await response.json();
        const text = data.content?.[0]?.text || '{}';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return JSON.parse(jsonMatch?.[0] || '{}') as TermExplanation;
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

        // History
        history.forEach(h => {
            messages.push({ role: h.role === 'user' ? 'user' : 'assistant', content: h.text });
        });

        // Current message with optional image
        if (image) {
            const imageData = image.includes(',') ? image.split(',')[1] : image;
            messages.push({
                role: 'user',
                content: [
                    { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageData } },
                    { type: 'text', text: message }
                ]
            });
        } else {
            messages.push({ role: 'user', content: message });
        }

        const response = await fetch(CLAUDE_API_URL, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                model: modelName,
                max_tokens: 2000,
                stream: true,
                system: `You are an AI assistant analyzing images. Use ${settings?.systemLanguage || 'English'}. Be direct and technical.`,
                messages
            })
        });

        if (!response.ok) throw new Error("Claude stream error");

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
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.type === 'content_block_delta' && data.delta?.text) {
                            accumulatedText += data.delta.text;
                            onUpdate(accumulatedText);
                        }
                    } catch { }
                }
            }
        }
    }

    async expandSearchQuery(query: string): Promise<string[][]> {
        const modelName = getCurrentModel();

        const response = await fetch(CLAUDE_API_URL, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                model: modelName,
                max_tokens: 300,
                messages: [{
                    role: 'user',
                    content: `Analyze "${query}". Break into semantic concepts with synonyms.
Output JSON only (no markdown): { "groups": [ ["word1", "syn1", "syn2"], ["word2", "syn3"] ] }`
                }]
            })
        });

        if (!response.ok) return [];
        const data = await response.json();
        const text = data.content?.[0]?.text || '{}';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(data.content?.[0]?.text || '{}');
        return parsed.groups || [];
    }

    async regenerateDimension(base64Image: string, dimension: DimensionKey, settings: UserSettings): Promise<PromptSegment> {
        const { getDimensionPrompt } = await import('./masterPrompt');
        const base64Data = base64Image.split(',')[1] || base64Image;
        const modelName = getCurrentModel();

        const response = await fetch(CLAUDE_API_URL, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                model: modelName,
                max_tokens: 500,
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Data } },
                        { type: 'text', text: getDimensionPrompt(dimension, settings) }
                    ]
                }]
            })
        });

        if (!response.ok) throw new Error("Claude API error");
        const data = await response.json();
        return JSON.parse(data.content?.[0]?.text || '{"original":"","translated":""}') as PromptSegment;
    }
}
