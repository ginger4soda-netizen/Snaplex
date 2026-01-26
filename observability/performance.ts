// ============================================
// Performance Monitoring
// ============================================
// 自定义性能指标追踪，用于监控关键用户体验指标
// ============================================

import * as Sentry from '@sentry/react';

// 存储性能 marks 以便清理
const activeMarks = new Set<string>();

const safeMark = (name: string) => {
    try {
        performance.mark(name);
        activeMarks.add(name);
    } catch (e) {
        console.warn(`Performance mark failed: ${name}`, e);
    }
};

const safeMeasure = (name: string, startMark: string, endMark: string): number | null => {
    try {
        performance.measure(name, startMark, endMark);
        const entries = performance.getEntriesByName(name, 'measure');
        const measure = entries[entries.length - 1]; // 获取最新的测量

        // 清理 marks
        performance.clearMarks(startMark);
        performance.clearMarks(endMark);
        performance.clearMeasures(name);
        activeMarks.delete(startMark);
        activeMarks.delete(endMark);

        return measure ? Math.round(measure.duration) : null;
    } catch (e) {
        console.warn(`Performance measure failed: ${name}`, e);
        return null;
    }
};

// 自定义性能指标追踪器
export const trackPerformance = {
    // ========================================
    // 图片处理性能
    // ========================================

    // 图片压缩开始
    imageCompressionStart: () => {
        safeMark('image-compression-start');
    },

    // 图片压缩结束
    imageCompressionEnd: (imageCount: number = 1) => {
        safeMark('image-compression-end');
        const duration = safeMeasure(
            'image-compression-duration',
            'image-compression-start',
            'image-compression-end'
        );

        if (duration !== null) {
            Sentry.addBreadcrumb({
                category: 'performance.image',
                message: `Image compression: ${duration}ms (${imageCount} images)`,
                level: 'info',
                data: {
                    duration_ms: duration,
                    image_count: imageCount,
                    avg_per_image: Math.round(duration / imageCount),
                },
            });
        }

        return duration;
    },

    // ========================================
    // AI 分析性能
    // ========================================

    // AI 分析开始
    analysisStart: () => {
        safeMark('analysis-start');
    },

    // AI 分析结束
    analysisEnd: (model: string, provider: string) => {
        safeMark('analysis-end');
        const duration = safeMeasure(
            'analysis-duration',
            'analysis-start',
            'analysis-end'
        );

        if (duration !== null) {
            Sentry.addBreadcrumb({
                category: 'performance.ai',
                message: `AI Analysis (${provider}/${model}): ${duration}ms`,
                level: 'info',
                data: {
                    duration_ms: duration,
                    model_name: model,
                    provider: provider,
                },
            });

            // 发送性能事务
            Sentry.setMeasurement('ai_analysis_duration', duration, 'millisecond');
        }

        return duration;
    },

    // ========================================
    // 维度刷新性能
    // ========================================

    // 单维度刷新开始
    dimensionRefreshStart: (dimension: string) => {
        safeMark(`dimension-refresh-${dimension}-start`);
    },

    // 单维度刷新结束
    dimensionRefreshEnd: (dimension: string, model: string) => {
        safeMark(`dimension-refresh-${dimension}-end`);
        const duration = safeMeasure(
            `dimension-refresh-${dimension}`,
            `dimension-refresh-${dimension}-start`,
            `dimension-refresh-${dimension}-end`
        );

        if (duration !== null) {
            Sentry.addBreadcrumb({
                category: 'performance.dimension',
                message: `Dimension refresh [${dimension}]: ${duration}ms`,
                level: 'info',
                data: {
                    duration_ms: duration,
                    dimension,
                    model_name: model,
                },
            });
        }

        return duration;
    },

    // ========================================
    // 聊天性能
    // ========================================

    // 聊天消息发送开始
    chatMessageStart: () => {
        safeMark('chat-message-start');
    },

    // 聊天首次响应（流式）
    chatFirstToken: () => {
        safeMark('chat-first-token');
        const duration = safeMeasure(
            'chat-ttft',
            'chat-message-start',
            'chat-first-token'
        );

        if (duration !== null) {
            Sentry.addBreadcrumb({
                category: 'performance.chat',
                message: `Chat TTFT (Time To First Token): ${duration}ms`,
                level: 'info',
                data: { ttft_ms: duration },
            });
        }

        return duration;
    },

    // 聊天完成
    chatMessageEnd: () => {
        safeMark('chat-message-end');
        const duration = safeMeasure(
            'chat-total-duration',
            'chat-message-start',
            'chat-message-end'
        );

        if (duration !== null) {
            Sentry.addBreadcrumb({
                category: 'performance.chat',
                message: `Chat complete: ${duration}ms`,
                level: 'info',
                data: { total_duration_ms: duration },
            });
        }

        return duration;
    },

    // ========================================
    // Wordbank/Printer 性能
    // ========================================

    // 术语解释开始
    termExplainStart: () => {
        safeMark('term-explain-start');
    },

    // 术语解释结束
    termExplainEnd: (term: string) => {
        safeMark('term-explain-end');
        const duration = safeMeasure(
            'term-explain-duration',
            'term-explain-start',
            'term-explain-end'
        );

        if (duration !== null) {
            Sentry.addBreadcrumb({
                category: 'performance.printer',
                message: `Term explanation: ${duration}ms`,
                level: 'info',
                data: {
                    duration_ms: duration,
                    term_length: term.length,
                },
            });
        }

        return duration;
    },

    // ========================================
    // 搜索性能
    // ========================================

    // 搜索开始
    searchStart: () => {
        safeMark('search-start');
    },

    // 搜索结束
    searchEnd: (resultCount: number) => {
        safeMark('search-end');
        const duration = safeMeasure(
            'search-duration',
            'search-start',
            'search-end'
        );

        if (duration !== null) {
            Sentry.addBreadcrumb({
                category: 'performance.search',
                message: `Search complete: ${duration}ms (${resultCount} results)`,
                level: 'info',
                data: {
                    duration_ms: duration,
                    result_count: resultCount,
                },
            });
        }

        return duration;
    },
};

// 页面加载性能（在应用初始化时调用）
export const reportPageLoadMetrics = () => {
    // 等待页面完全加载
    if (document.readyState === 'complete') {
        captureLoadMetrics();
    } else {
        window.addEventListener('load', captureLoadMetrics, { once: true });
    }
};

const captureLoadMetrics = () => {
    try {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

        if (navigation) {
            const metrics = {
                dns_lookup: Math.round(navigation.domainLookupEnd - navigation.domainLookupStart),
                tcp_connect: Math.round(navigation.connectEnd - navigation.connectStart),
                ttfb: Math.round(navigation.responseStart - navigation.requestStart),
                dom_content_loaded: Math.round(navigation.domContentLoadedEventEnd - navigation.startTime),
                page_load: Math.round(navigation.loadEventEnd - navigation.startTime),
            };

            Sentry.addBreadcrumb({
                category: 'performance.page',
                message: `Page load: ${metrics.page_load}ms`,
                level: 'info',
                data: metrics,
            });
        }
    } catch (e) {
        console.warn('Failed to capture page load metrics', e);
    }
};
