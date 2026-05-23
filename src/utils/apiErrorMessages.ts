// API Error Messages - 7 Language Support
// This file provides localized error messages for API providers

export type SupportedLanguage = 'English' | 'Chinese' | 'Spanish' | 'Japanese' | 'French' | 'German' | 'Korean';

export interface ApiErrorMessages {
    regionRestricted: string;
    invalidApiKey: string;
    rateLimitExceeded: string;
    genericError: (provider: string, status: number) => string;
}

const errorMessages: Record<SupportedLanguage, ApiErrorMessages> = {
    English: {
        regionRestricted: "The current VPN node region does not support this model. Please try switching to a different node.",
        invalidApiKey: "API Key is invalid or expired. Please check your API Key in Settings.",
        rateLimitExceeded: "API rate limit exceeded or quota insufficient. Please try again later or check your account balance.",
        genericError: (provider, status) => `${provider} API error (${status})`
    },
    Chinese: {
        regionRestricted: "当前 VPN 节点所在的区域不支持当前模型。请尝试切换节点重试。",
        invalidApiKey: "API Key 无效或已过期，请在设置中检查您的 API Key。",
        rateLimitExceeded: "API 调用次数超限或配额不足，请稍后重试或检查您的账户余额。",
        genericError: (provider, status) => `${provider} API 错误 (${status})`
    },
    Spanish: {
        regionRestricted: "La región del nodo VPN actual no admite este modelo. Intente cambiar a un nodo diferente.",
        invalidApiKey: "La clave API no es válida o ha expirado. Verifique su clave API en Configuración.",
        rateLimitExceeded: "Límite de tasa de API excedido o cuota insuficiente. Inténtelo de nuevo más tarde o verifique el saldo de su cuenta.",
        genericError: (provider, status) => `Error de API de ${provider} (${status})`
    },
    Japanese: {
        regionRestricted: "現在のVPNノードの地域ではこのモデルはサポートされていません。別のノードに切り替えてお試しください。",
        invalidApiKey: "APIキーが無効または期限切れです。設定でAPIキーを確認してください。",
        rateLimitExceeded: "APIのレート制限を超過したか、クォータが不足しています。しばらくしてから再試行するか、アカウント残高を確認してください。",
        genericError: (provider, status) => `${provider} APIエラー (${status})`
    },
    French: {
        regionRestricted: "La région du nœud VPN actuel ne prend pas en charge ce modèle. Essayez de passer à un autre nœud.",
        invalidApiKey: "La clé API est invalide ou expirée. Veuillez vérifier votre clé API dans les Paramètres.",
        rateLimitExceeded: "Limite de taux API dépassée ou quota insuffisant. Réessayez plus tard ou vérifiez le solde de votre compte.",
        genericError: (provider, status) => `Erreur API ${provider} (${status})`
    },
    German: {
        regionRestricted: "Die aktuelle VPN-Knotenregion unterstützt dieses Modell nicht. Bitte versuchen Sie, zu einem anderen Knoten zu wechseln.",
        invalidApiKey: "API-Schlüssel ist ungültig oder abgelaufen. Bitte überprüfen Sie Ihren API-Schlüssel in den Einstellungen.",
        rateLimitExceeded: "API-Ratenlimit überschritten oder Kontingent unzureichend. Bitte versuchen Sie es später erneut oder überprüfen Sie Ihren Kontostand.",
        genericError: (provider, status) => `${provider} API-Fehler (${status})`
    },
    Korean: {
        regionRestricted: "현재 VPN 노드 지역에서는 이 모델을 지원하지 않습니다. 다른 노드로 전환해 보세요.",
        invalidApiKey: "API 키가 유효하지 않거나 만료되었습니다. 설정에서 API 키를 확인하세요.",
        rateLimitExceeded: "API 호출 한도 초과 또는 할당량이 부족합니다. 나중에 다시 시도하거나 계정 잔액을 확인하세요.",
        genericError: (provider, status) => `${provider} API 오류 (${status})`
    }
};

// Get system language from localStorage
function getSystemLanguage(): SupportedLanguage {
    try {
        const stored = localStorage.getItem('snaplex_settings');
        if (stored) {
            const settings = JSON.parse(stored);
            // settings.systemLanguage is like "Chinese (中文)" - extract first word
            const lang = settings.systemLanguage?.split(' ')[0];
            if (lang && lang in errorMessages) {
                return lang as SupportedLanguage;
            }
        }
    } catch {
        // Ignore parse errors
    }
    return 'English';
}

// Main export function - get localized error message
export function getApiError(type: 'regionRestricted' | 'invalidApiKey' | 'rateLimitExceeded'): string {
    const lang = getSystemLanguage();
    return errorMessages[lang][type];
}

// Get generic error message
export function getGenericApiError(provider: string, status: number): string {
    const lang = getSystemLanguage();
    return errorMessages[lang].genericError(provider, status);
}

// Export for direct access if needed
export { errorMessages };
