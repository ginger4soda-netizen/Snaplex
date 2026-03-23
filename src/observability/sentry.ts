// ============================================
// Sentry Error Tracking with Privacy Protection
// ============================================
// 🔐 隐私优先：所有敏感数据在发送前被过滤
// ============================================

import * as Sentry from '@sentry/react';

// 隐私过滤器：在发送前清洗敏感数据
const privacyScrubber = (event: Sentry.Event): Sentry.Event | null => {
    // 过滤 breadcrumbs 中的敏感信息
    if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
            if (breadcrumb.data) {
                // 移除任何可能包含图片或 API Key 的数据
                delete breadcrumb.data.image;
                delete breadcrumb.data.base64;
                delete breadcrumb.data.apiKey;
                delete breadcrumb.data.prompt;
                delete breadcrumb.data.contents;
            }
            return breadcrumb;
        });
    }

    // 过滤请求体中的敏感数据
    if (event.request?.data && typeof event.request.data === 'object') {
        const sanitized = { ...(event.request.data as Record<string, unknown>) };
        delete sanitized.image;
        delete sanitized.base64;
        delete sanitized.contents; // Gemini API 请求体字段
        delete sanitized.apiKey;
        delete sanitized.prompt;
        event.request.data = sanitized;
    }

    // 过滤 extra 数据
    if (event.extra) {
        delete event.extra.image;
        delete event.extra.base64;
        delete event.extra.apiKey;
        delete event.extra.prompt;
        delete event.extra.contents;
    }

    // 过滤 contexts
    if (event.contexts) {
        Object.keys(event.contexts).forEach(key => {
            const ctx = event.contexts![key];
            if (ctx && typeof ctx === 'object') {
                delete (ctx as Record<string, unknown>).image;
                delete (ctx as Record<string, unknown>).base64;
                delete (ctx as Record<string, unknown>).apiKey;
            }
        });
    }

    return event;
};

export const initSentry = () => {
    const dsn = import.meta.env.VITE_SENTRY_DSN;

    // 仅在有 DSN 且为生产环境时启用
    if (!dsn) {
        console.log('🔭 Sentry: No DSN configured, skipping initialization');
        return;
    }

    Sentry.init({
        dsn,

        // 仅在生产环境启用
        enabled: import.meta.env.PROD,

        // 环境标识
        environment: import.meta.env.PROD ? 'production' : 'development',

        // 性能监控采样率 10%
        tracesSampleRate: 0.1,

        // 错误采样 100%
        sampleRate: 1.0,

        // Session Replay 配置
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0.5,

        // 🔐 隐私保护：发送前过滤
        beforeSend: (event) => privacyScrubber(event) as Sentry.ErrorEvent | null,

        // 🔐 过滤敏感 breadcrumbs
        beforeBreadcrumb(breadcrumb) {
            // 过滤包含敏感 URL 参数的 fetch/xhr 请求
            if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
                if (breadcrumb.data?.url) {
                    // 移除 URL 中可能的 API Key 参数
                    try {
                        const url = new URL(breadcrumb.data.url);
                        url.searchParams.delete('key');
                        url.searchParams.delete('api_key');
                        url.searchParams.delete('apiKey');
                        breadcrumb.data.url = url.toString();
                    } catch {
                        // 忽略无效 URL
                    }
                }
            }
            return breadcrumb;
        },

        // 忽略常见的无害错误
        ignoreErrors: [
            'ResizeObserver loop limit exceeded',
            'ResizeObserver loop completed with undelivered notifications',
            'Non-Error promise rejection captured',
            'Load failed', // 常见的资源加载失败
            'cancelled', // 用户取消操作
            // Dynamic import failures (network/CDN issues, not code bugs)
            'Failed to fetch dynamically imported module',
            'Importing a module script failed',
            'ChunkLoadError',
            // MISSING_API_KEY is expected user state, not an error
            'MISSING_API_KEY',
        ],
    });

    console.log('🔭 Sentry: Initialized');
};

// 包装的错误追踪函数，自动添加脱敏上下文
export const trackError = (
    error: Error,
    context?: {
        model_name?: string;
        error_type?: string;
        api_status?: 'success' | 'error';
        image_count?: number;
        prompt_length?: number;
        provider?: string;
        http_status?: number;
        dimension?: string; // For dimension-specific errors
    }
) => {
    Sentry.withScope((scope) => {
        if (context) {
            // 设置标签（可搜索）
            scope.setTags({
                model_name: context.model_name,
                error_type: context.error_type,
                api_status: context.api_status,
                provider: context.provider,
                dimension: context.dimension,
            });
            // 设置额外数据（详情展示）
            scope.setExtras({
                image_count: context.image_count,
                prompt_length: context.prompt_length,
                http_status: context.http_status,
            });
        }
        Sentry.captureException(error);
    });
};

// API 状态追踪（不记录 Key，只记录状态）
export const trackApiStatus = (
    provider: string,
    model: string,
    status: 'success' | 'error',
    errorCode?: number | string
) => {
    Sentry.addBreadcrumb({
        category: 'api.status',
        message: `${provider}/${model} - ${status}`,
        level: status === 'success' ? 'info' : 'error',
        data: {
            provider,
            model,
            status,
            errorCode: errorCode?.toString(),
        },
    });
};

// 用户行为追踪 breadcrumb
export const trackUserAction = (
    action: string,
    category: string,
    data?: Record<string, string | number | boolean>
) => {
    Sentry.addBreadcrumb({
        category,
        message: action,
        level: 'info',
        data,
    });
};
