import React, { useState } from 'react';
import { docStructure } from '../data/docStructure';
import DocSidebar from './DocSidebar';
import DocContent from './DocContent';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    systemLanguage?: string;
    onOpenSettings: () => void;
}

const DocReader: React.FC<Props> = ({ isOpen, onClose, systemLanguage, onOpenSettings }) => {
    const [activeSection, setActiveSection] = useState('intro');

    if (!isOpen) return null;

    const scrollToSection = (id: string) => {
        setActiveSection(id);
        const el = document.getElementById(`doc-${id}`);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="fixed inset-0 z-[60] bg-stone-900/50 backdrop-blur-sm flex items-center justify-center p-0 md:p-6 animate-[fadeIn_0.2s_ease-out]">
            <div
                className="bg-white w-full h-full md:rounded-3xl shadow-2xl flex flex-col md:flex-row overflow-hidden relative animate-[slideUp_0.3s_ease-out]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-50 p-2 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors"
                >
                    <svg className="w-6 h-6 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                <DocSidebar
                    sections={docStructure}
                    activeSection={activeSection}
                    onSelect={scrollToSection}
                    systemLanguage={systemLanguage}
                />

                <DocContent
                    sections={docStructure}
                    systemLanguage={systemLanguage}
                    onOpenSettings={() => {
                        onClose();
                        onOpenSettings();
                    }}
                />
            </div>
        </div>
    );
};

export default DocReader;
