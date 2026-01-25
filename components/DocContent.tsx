import React from 'react';
import { DocSection, DocItem } from '../data/docStructure';
import { getTranslation } from '../translations';

interface Props {
    sections: DocSection[];
    systemLanguage?: string;
    onOpenSettings: () => void;
}

const DocContent: React.FC<Props> = ({ sections, systemLanguage, onOpenSettings }) => {
    const t = getTranslation(systemLanguage);
    const isChinese = systemLanguage?.includes('Chinese');

    const getTrans = (key?: string) => {
        if (!key) return null;
        const parts = key.split('.');
        let current: any = t;
        for (const part of parts) {
            if (current && current[part]) {
                current = current[part];
            } else {
                return key;
            }
        }
        return current;
    };

    const renderItem = (item: DocItem, idx: number) => {
        switch (item.type) {
            case 'text':
                return (
                    <div key={idx} className="mb-5">
                        {item.titleKey && (
                            <h4 className="font-bold text-stone-800 text-base mb-2">{getTrans(item.titleKey)}</h4>
                        )}
                        <p className="text-stone-600 leading-relaxed text-sm whitespace-pre-line">{getTrans(item.contentKey)}</p>
                    </div>
                );
            case 'warning':
                return (
                    <div key={idx} className="mb-5 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
                        {item.titleKey && (
                            <h4 className="font-bold text-red-700 text-sm mb-2 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                {getTrans(item.titleKey)}
                            </h4>
                        )}
                        <p className="text-stone-700 text-sm leading-relaxed whitespace-pre-line">{getTrans(item.contentKey)}</p>
                    </div>
                );
            case 'tip':
                return (
                    <div key={idx} className="mb-5 p-4 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg">
                        {item.titleKey && (
                            <h4 className="font-bold text-blue-700 text-sm mb-2 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                {getTrans(item.titleKey)}
                            </h4>
                        )}
                        <p className="text-stone-700 text-sm leading-relaxed whitespace-pre-line">{getTrans(item.contentKey)}</p>
                    </div>
                );
            case 'note':
                return (
                    <div key={idx} className="mb-5 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg">
                        {item.titleKey && (
                            <h4 className="font-bold text-yellow-700 text-sm mb-2">{getTrans(item.titleKey)}</h4>
                        )}
                        <p className="text-stone-700 text-sm leading-relaxed whitespace-pre-line">{getTrans(item.contentKey)}</p>
                    </div>
                );
            case 'step':
                return (
                    <div key={idx} className="mb-6 pl-6 relative">
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-stone-200"></div>
                        <div className="absolute left-[-4px] top-1 w-2.5 h-2.5 rounded-full bg-stone-800 ring-2 ring-white"></div>
                        <h4 className="font-bold text-stone-900 text-sm mb-1">{getTrans(item.titleKey)}</h4>
                        <p className="text-stone-600 text-sm leading-relaxed whitespace-pre-line">{getTrans(item.contentKey)}</p>
                        {item.ctaAction === 'openSettings' && (
                            <button
                                onClick={onOpenSettings}
                                className="mt-3 px-4 py-1.5 bg-stone-800 text-white rounded-lg font-medium text-xs hover:bg-stone-700 transition-all shadow flex items-center gap-2"
                            >
                                <span>{isChinese ? '前往设置' : 'Go to Configure'}</span>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                            </button>
                        )}
                    </div>
                );
            case 'list':
                return (
                    <div key={idx} className="mb-5">
                        {item.titleKey && (
                            <h4 className="font-bold text-stone-800 text-sm mb-2">{getTrans(item.titleKey)}</h4>
                        )}
                        <ul className="space-y-1.5 text-stone-600 text-sm">
                            {item.listItemsKey?.map((k, i) => (
                                <li key={i} className="flex items-start gap-2">
                                    <span className="text-stone-400 mt-0.5">•</span>
                                    <span className="whitespace-pre-line">{getTrans(k)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            case 'qa':
                return (
                    <div key={idx} className="mb-5 pb-4 border-b border-stone-100 last:border-b-0">
                        <h4 className="font-bold text-stone-900 text-sm mb-1 flex items-start gap-2">
                            <span className="text-blue-500 font-black">Q:</span>
                            <span>{getTrans(item.titleKey)}</span>
                        </h4>
                        <p className="text-stone-600 text-sm leading-relaxed pl-5 whitespace-pre-line">
                            <span className="text-green-600 font-bold">A:</span> {getTrans(item.contentKey)}
                        </p>
                    </div>
                );
            case 'table':
                const tableData = getTrans(item.tableKey);
                if (!tableData || !Array.isArray(tableData)) return null;
                return (
                    <div key={idx} className="mb-5 overflow-x-auto">
                        <table className="w-full text-sm border border-stone-200 rounded-lg overflow-hidden">
                            <thead className="bg-stone-100">
                                <tr>
                                    {tableData[0]?.map((header: string, i: number) => (
                                        <th key={i} className="px-3 py-2 text-left font-bold text-stone-700 border-b border-stone-200">{header}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {tableData.slice(1).map((row: string[], rowIdx: number) => (
                                    <tr key={rowIdx} className="border-b border-stone-100 last:border-b-0">
                                        {row.map((cell, cellIdx) => (
                                            <td key={cellIdx} className="px-3 py-2 text-stone-600">{cell}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="flex-1 p-6 md:p-10 h-full overflow-y-auto scroll-smooth">
            <div className="max-w-3xl mx-auto pb-20">
                {sections.map(section => (
                    <section key={section.id} id={`doc-${section.id}`} className="mb-12 scroll-mt-6">
                        <h2 className="text-xl md:text-2xl font-black text-stone-900 mb-6 pb-3 border-b-2 border-stone-200">
                            {getTrans(section.titleKey)}
                        </h2>
                        {section.items.map((item, idx) => renderItem(item, idx))}
                    </section>
                ))}
            </div>
        </div>
    );
};

export default DocContent;
