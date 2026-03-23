export interface DocItem {
    type: 'text' | 'warning' | 'step' | 'list' | 'note' | 'tip' | 'table' | 'qa';
    titleKey?: string;
    contentKey?: string;
    ctaAction?: 'openSettings';
    listItemsKey?: string[];
    tableKey?: string;
}

export interface DocSection {
    id: string;
    titleKey: string;
    items: DocItem[];
}

export const docStructure: DocSection[] = [
    {
        id: 'intro',
        titleKey: 'doc.intro.title',
        items: [
            { type: 'text', contentKey: 'doc.intro.greeting' },
            { type: 'text', contentKey: 'doc.intro.desc' },
            { type: 'text', contentKey: 'doc.intro.personal' },
            { type: 'tip', contentKey: 'doc.intro.github' }
        ]
    },
    {
        id: 'important',
        titleKey: 'doc.important.title',
        items: [
            { type: 'warning', titleKey: 'doc.important.apiKey.title', contentKey: 'doc.important.apiKey.desc' },
            { type: 'tip', titleKey: 'doc.important.apiKey.tipTitle', contentKey: 'doc.important.apiKey.tipDesc' },
            { type: 'table', tableKey: 'doc.important.apiKey.table' },
            { type: 'text', titleKey: 'doc.important.storage.title', contentKey: 'doc.important.storage.desc' },
            { type: 'warning', contentKey: 'doc.important.storage.warning' },
            { type: 'list', titleKey: 'doc.important.storage.scenariosTitle', listItemsKey: ['doc.important.storage.scenario1', 'doc.important.storage.scenario2', 'doc.important.storage.scenario3', 'doc.important.storage.scenario4'] },
            { type: 'tip', titleKey: 'doc.important.storage.backupTitle', contentKey: 'doc.important.storage.backupDesc' },
            { type: 'list', listItemsKey: ['doc.important.storage.backupStep1', 'doc.important.storage.backupStep2', 'doc.important.storage.backupStep3', 'doc.important.storage.backupStep4'] },
            { type: 'text', contentKey: 'doc.important.storage.exportNote' },
            { type: 'text', titleKey: 'doc.important.hosting.title', contentKey: 'doc.important.hosting.desc' }
        ]
    },
    {
        id: 'quickstart',
        titleKey: 'doc.quickstart.title',
        items: [
            { type: 'text', titleKey: 'doc.quickstart.stepsTitle' },
            { type: 'step', titleKey: 'doc.quickstart.step1.title', contentKey: 'doc.quickstart.step1.desc', ctaAction: 'openSettings' },
            { type: 'step', titleKey: 'doc.quickstart.step2.title', contentKey: 'doc.quickstart.step2.desc' },
            { type: 'step', titleKey: 'doc.quickstart.step3.title', contentKey: 'doc.quickstart.step3.desc' },
            { type: 'step', titleKey: 'doc.quickstart.step4.title', contentKey: 'doc.quickstart.step4.desc' },
            { type: 'note', titleKey: 'doc.quickstart.devNote.title', contentKey: 'doc.quickstart.devNote.desc' },
            { type: 'text', titleKey: 'doc.quickstart.advanced.title' },
            { type: 'list', listItemsKey: ['doc.quickstart.advanced.refresh', 'doc.quickstart.advanced.chat', 'doc.quickstart.advanced.history', 'doc.quickstart.advanced.printer'] }
        ]
    },
    {
        id: 'practices',
        titleKey: 'doc.practices.title',
        items: [
            { type: 'list', listItemsKey: ['doc.practices.backup', 'doc.practices.testKey', 'doc.practices.search', 'doc.practices.batch'] }
        ]
    },
    {
        id: 'faq',
        titleKey: 'doc.faq.title',
        items: [
            { type: 'qa', titleKey: 'doc.faq.q1', contentKey: 'doc.faq.a1' },
            { type: 'qa', titleKey: 'doc.faq.q2', contentKey: 'doc.faq.a2' },
            { type: 'qa', titleKey: 'doc.faq.q3', contentKey: 'doc.faq.a3' },
            { type: 'qa', titleKey: 'doc.faq.q4', contentKey: 'doc.faq.a4' },
            { type: 'qa', titleKey: 'doc.faq.q5', contentKey: 'doc.faq.a5' },
            { type: 'qa', titleKey: 'doc.faq.q6', contentKey: 'doc.faq.a6' },
            { type: 'qa', titleKey: 'doc.faq.q7', contentKey: 'doc.faq.a7' }
        ]
    },
    {
        id: 'feedback',
        titleKey: 'doc.feedback.title',
        items: [
            { type: 'list', listItemsKey: ['doc.feedback.github', 'doc.feedback.social'] },
            { type: 'text', contentKey: 'doc.feedback.meta' }
        ]
    }
];
