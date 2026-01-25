import React from 'react';
import { DocSection } from '../data/docStructure';
import { getTranslation } from '../translations';

interface Props {
    sections: DocSection[];
    activeSection: string;
    onSelect: (id: string) => void;
    systemLanguage?: string;
}

const DocSidebar: React.FC<Props> = ({ sections, activeSection, onSelect, systemLanguage }) => {
    const t = getTranslation(systemLanguage);

    // Helper to safely get nested translation by key path (e.g. 'doc.intro.title')
    const getTrans = (key: string) => {
        const parts = key.split('.');
        let current: any = t;
        for (const part of parts) {
            if (current && current[part]) {
                current = current[part];
            } else {
                return key; // Fallback to key if not found
            }
        }
        return current;
    };

    return (
        <nav className="w-full md:w-64 flex-shrink-0 md:border-r border-stone-200 p-6 md:h-full overflow-y-auto bg-stone-50">
            <h2 className="text-xl font-black text-stone-900 mb-6 hidden md:block">
                {getTrans('doc.intro.title') || 'User Guide'}
            </h2>
            <ul className="space-y-1">
                {sections.map((section) => (
                    <li key={section.id}>
                        <button
                            onClick={() => onSelect(section.id)}
                            className={`w-full text-left px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${activeSection === section.id
                                    ? 'bg-stone-900 text-white shadow-md transform scale-105'
                                    : 'text-stone-500 hover:bg-stone-200 hover:text-stone-900'
                                }`}
                        >
                            {getTrans(section.titleKey)}
                        </button>
                    </li>
                ))}
            </ul>
        </nav>
    );
};

export default DocSidebar;
