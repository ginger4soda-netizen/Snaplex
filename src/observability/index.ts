// ============================================
// Observability Module - Unified Entry Point
// ============================================
// Snaplex 监控系统入口
// 集成：Vercel Analytics + Sentry + 性能监控
// ============================================

import { inject } from '@vercel/analytics';
import { initSentry, trackError, trackApiStatus, trackUserAction } from './sentry';
import { trackPerformance, reportPageLoadMetrics } from './performance';

// 初始化所有观测工具
export const initObservability = () => {
    // 1. Vercel Analytics (流量基础监控)
    // 自动收集：UV/PV、地理位置、设备分布、Referrer
    inject({
        mode: import.meta.env.PROD ? 'production' : 'development',
        debug: !import.meta.env.PROD, // 开发环境显示调试信息
    });

    // 2. Sentry (错误追踪)
    initSentry();

    // 3. 页面加载性能指标
    reportPageLoadMetrics();

    console.log('🔭 Observability: All systems initialized');
};

// ========================================
// 导出便捷工具
// ========================================

// 错误追踪
export { trackError, trackApiStatus, trackUserAction };

// 性能追踪
export { trackPerformance };

// ========================================
// 便捷的事件追踪封装
// ========================================

/**
 * 追踪 API 调用（自动处理成功/失败）
 * @example
 * const result = await withApiTracking(
 *   () => analyzeImage(image, settings),
 *   'gemini',
 *   'gemini-2.0-flash'
 * );
 */
export const withApiTracking = async <T>(
    apiCall: () => Promise<T>,
    provider: string,
    model: string
): Promise<T> => {
    trackPerformance.analysisStart();

    try {
        const result = await apiCall();
        trackApiStatus(provider, model, 'success');
        trackPerformance.analysisEnd(model, provider);
        return result;
    } catch (error) {
        const err = error as Error;
        const httpStatus = (err as any).status || (err as any).statusCode;

        trackApiStatus(provider, model, 'error', httpStatus);
        trackPerformance.analysisEnd(model, provider);

        trackError(err, {
            provider,
            model_name: model,
            api_status: 'error',
            error_type: err.name || 'ApiError',
            http_status: httpStatus,
        });

        throw error;
    }
};

// ========================================
// 类型定义
// ========================================

// 允许收集的脱敏元数据类型
export interface DesensitizedMetadata {
    image_count?: number;       // 上传图片数量
    prompt_length?: number;     // 提示词字数
    model_name?: string;        // 如 "gpt-4o", "gemini-2.0-flash"
    provider?: string;          // 如 "gemini", "openai", "claude"
    error_type?: string;        // 如 "500 Network Error"
    api_status?: 'success' | 'error';
    http_status?: number;
    dimension?: string;         // 如 "subject", "style"
    action?: string;            // 用户操作类型
}
