// Barrel file for providers
export * from './types';
export { getMasterAnalysisPrompt } from './masterPrompt';
export { GeminiProvider } from './gemini';
export { OpenAIProvider } from './openai';
export { ClaudeProvider } from './claude';
export { SiliconFlowProvider } from './siliconflow';

import { AIProvider, ProviderType, getCurrentProvider } from './types';
import { GeminiProvider } from './gemini';
import { OpenAIProvider } from './openai';
import { ClaudeProvider } from './claude';
import { SiliconFlowProvider } from './siliconflow';

// Provider instances (lazy-loaded singletons)
const providers: Partial<Record<ProviderType, AIProvider>> = {};

// Factory function to get the current provider
export const getProvider = (): AIProvider => {
    const providerType = getCurrentProvider();

    if (!providers[providerType]) {
        switch (providerType) {
            case 'openai':
                providers[providerType] = new OpenAIProvider();
                break;
            case 'claude':
                providers[providerType] = new ClaudeProvider();
                break;
            case 'siliconflow':
                providers[providerType] = new SiliconFlowProvider();
                break;
            case 'gemini':
            default:
                providers[providerType] = new GeminiProvider();
                break;
        }
    }

    return providers[providerType]!;
};
