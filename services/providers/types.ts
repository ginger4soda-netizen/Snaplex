import { AnalysisResult, UserSettings, ChatMessage, PromptSegment, DimensionKey } from '../../types';

// Term explanation response
export interface TermExplanation {
    def: string;
    app: string;
}

// Provider interface - all providers must implement this
export interface AIProvider {
    readonly name: string;

    // Core image analysis
    analyzeImage(base64Image: string, settings: UserSettings): Promise<AnalysisResult>;

    // Term explanation for printer
    explainTerm(term: string, language: string): Promise<TermExplanation>;

    // Chat with streaming
    chatStream(
        history: ChatMessage[],
        message: string,
        image: string | undefined,
        onUpdate: (text: string) => void,
        settings?: UserSettings
    ): Promise<void>;

    // Semantic search expansion
    expandSearchQuery(query: string): Promise<string[][]>;

    // Regenerate a single dimension
    regenerateDimension(
        base64Image: string,
        dimension: DimensionKey,
        settings: UserSettings
    ): Promise<PromptSegment>;
}

// Provider identifiers
export type ProviderType = 'gemini' | 'openai' | 'claude' | 'siliconflow';

// Model definitions per provider
export interface ModelDefinition {
    id: string;
    label: string;
    supportsVision: boolean;
}

export const PROVIDER_MODELS: Record<ProviderType, ModelDefinition[]> = {
    gemini: [
        { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Recommended)', supportsVision: true },
        { id: 'gemini-3.0-flash', label: 'Gemini 3.0 Flash (Experimental)', supportsVision: true },
    ],
    openai: [
        { id: 'gpt-4o', label: 'GPT-4o (Recommended)', supportsVision: true },
        { id: 'gpt-4-turbo', label: 'GPT-4 Turbo', supportsVision: true },
        { id: 'gpt-4o-mini', label: 'GPT-4o Mini', supportsVision: true },
    ],
    claude: [
        { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', supportsVision: true },
        { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', supportsVision: true },
        { id: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku (Fast)', supportsVision: true },
    ],
    siliconflow: [
        { id: 'THUDM/GLM-4.1V-9B-Thinking', label: 'GLM-4.1V 9B Thinking (Free)', supportsVision: true },
        { id: 'Pro/Qwen/Qwen2.5-VL-7B-Instruct', label: 'Qwen2.5-VL 7B (Pro)', supportsVision: true },
        { id: 'Qwen/Qwen3-VL-8B-Instruct', label: 'Qwen3-VL 8B', supportsVision: true },
    ],

};

export const PROVIDER_LABELS: Record<ProviderType, string> = {
    gemini: 'Google Gemini',
    openai: 'OpenAI',
    claude: 'Anthropic Claude',
    siliconflow: 'SiliconFlow',
};

// LocalStorage keys
export const STORAGE_KEYS = {
    PROVIDER: 'SNAPLEX_PROVIDER',
    MODEL: 'SNAPLEX_MODEL_ID',
    API_KEY_PREFIX: 'SNAPLEX_API_KEY_',
};

// Helper to get API key for a provider
export const getApiKey = (provider: ProviderType): string | null => {
    return localStorage.getItem(`${STORAGE_KEYS.API_KEY_PREFIX}${provider.toUpperCase()}`);
};

// Helper to set API key for a provider
export const setApiKey = (provider: ProviderType, key: string): void => {
    localStorage.setItem(`${STORAGE_KEYS.API_KEY_PREFIX}${provider.toUpperCase()}`, key.trim());
};

// Helper to get current provider
export const getCurrentProvider = (): ProviderType => {
    return (localStorage.getItem(STORAGE_KEYS.PROVIDER) as ProviderType) || 'gemini';
};

// Helper to get current model
export const getCurrentModel = (): string => {
    const provider = getCurrentProvider();
    const storedModel = localStorage.getItem(STORAGE_KEYS.MODEL);
    if (storedModel) return storedModel;
    // Default to first model of current provider
    return PROVIDER_MODELS[provider][0]?.id || 'gemini-2.5-flash';
};
