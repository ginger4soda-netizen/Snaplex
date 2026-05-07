import React, { useRef, useState, useEffect, useCallback } from 'react';
import { get, set } from 'idb-keyval';
import { ChatMessage, UserSettings, CustomChip } from '../../types';
import { sendChatMessageStream } from '../../services/geminiService';
import { getTranslation, ChipData } from '../../translations';
import MarkdownRenderer from './MarkdownRenderer';
import ChipEditorModal from './ChipEditorModal';

interface Props {
    messages: ChatMessage[];
    onUpdateMessages: (msgs: ChatMessage[]) => void;
    imageContext?: string;
    systemLanguage?: string;
    settings?: UserSettings;
}

const IDB_KEY_ALL_CHIPS = 'snaplex_all_chips';

interface UnifiedChip {
    id: string;
    label: string;
    prompt: string;
    isDefault?: boolean;
}

const ChatBot: React.FC<Props> = ({ messages, onUpdateMessages, imageContext, systemLanguage, settings }) => {
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const endRef = useRef<HTMLDivElement>(null);
    const initialized = useRef(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const [allChips, setAllChips] = useState<UnifiedChip[]>([]);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingChip, setEditingChip] = useState<CustomChip | null>(null);

    const [deleteMode, setDeleteMode] = useState(false);
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);
    const pressStartPos = useRef<{ x: number; y: number } | null>(null);
    const hasMoved = useRef(false);

    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    // Source-of-truth for the chip currently being dragged. Refs survive
    // re-renders and don't lag behind state updates the way `draggedId` can.
    const draggedIdRef = useRef<string | null>(null);

    const abortRef = useRef<AbortController | null>(null);

    const t = getTranslation(systemLanguage);
    const defaultChipsFromTranslation: ChipData[] = t.chatChips || [];

    useEffect(() => {
        const loadChips = async () => {
            try {
                const saved = await get(IDB_KEY_ALL_CHIPS);
                if (Array.isArray(saved) && saved.length > 0) {
                    setAllChips(saved);
                } else {
                    const defaults: UnifiedChip[] = defaultChipsFromTranslation.map((chip, idx) => ({
                        id: `default-${idx}`,
                        label: chip.label,
                        prompt: chip.prompt,
                        isDefault: true
                    }));
                    setAllChips(defaults);
                    await set(IDB_KEY_ALL_CHIPS, defaults);
                }
            } catch (e) {
                console.error('Failed to load chips:', e);
                const defaults: UnifiedChip[] = defaultChipsFromTranslation.map((chip, idx) => ({
                    id: `default-${idx}`,
                    label: chip.label,
                    prompt: chip.prompt,
                    isDefault: true
                }));
                setAllChips(defaults);
            }
        };
        loadChips();
    }, []);

    // Sync default chips with current language - runs on mount and when language changes
    useEffect(() => {
        // Skip if no chips loaded yet
        if (allChips.length === 0) return;

        const defaultsMap = new Map(defaultChipsFromTranslation.map((d, i) => [`default-${i}`, d]));
        let hasChanges = false;

        const newChips = allChips.map(chip => {
            if (chip.isDefault && chip.id.startsWith('default-')) {
                const newContent = defaultsMap.get(chip.id);
                if (newContent && (newContent.label !== chip.label || newContent.prompt !== chip.prompt)) {
                    hasChanges = true;
                    return { ...chip, label: newContent.label, prompt: newContent.prompt };
                }
            }
            return chip;
        });

        if (hasChanges) {
            setAllChips(newChips);
            set(IDB_KEY_ALL_CHIPS, newChips).catch(e => console.error('Failed to update chips lang', e));
        }
    }, [systemLanguage, allChips.length > 0]);

    const saveChips = useCallback(async (chips: UnifiedChip[]) => {
        setAllChips(chips);
        try {
            await set(IDB_KEY_ALL_CHIPS, chips);
        } catch (e) {
            console.error('Failed to save chips:', e);
        }
    }, []);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    // Track previous messages length to detect reset
    const prevMessagesLength = useRef(messages.length);

    useEffect(() => {
        // Reset initialized when messages become empty (new image/context)
        if (messages.length === 0 && prevMessagesLength.current > 0) {
            initialized.current = false;
        }
        prevMessagesLength.current = messages.length;
    }, [messages.length]);

    useEffect(() => {
        if (!initialized.current && messages.length === 0) {
            initialized.current = true;
            const greetingMsg: ChatMessage = {
                id: Date.now().toString(), role: 'model',
                text: t.chatGreeting,
                timestamp: Date.now()
            };
            onUpdateMessages([greetingMsg]);
        }
    }, [messages, t, onUpdateMessages]);

    const processSend = async (textToSend: string) => {
        if (!textToSend.trim() || loading) return;
        const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: textToSend, timestamp: Date.now() };
        const newHistory = [...messages, userMsg];
        const modelMsgId = (Date.now() + 1).toString();
        const modelMsg: ChatMessage = { id: modelMsgId, role: 'model', text: '', timestamp: Date.now() };
        onUpdateMessages([...newHistory, modelMsg]);
        setInput('');
        setLoading(true);

        const controller = new AbortController();
        abortRef.current = controller;
        let lastText = '';

        try {
            await sendChatMessageStream(newHistory, textToSend, imageContext, (streamedText) => {
                if (controller.signal.aborted) return;
                lastText = streamedText;
                onUpdateMessages([...newHistory, { ...modelMsg, text: streamedText }]);
            }, settings, controller.signal);

            if (controller.signal.aborted) {
                const stoppedSuffix = lastText ? `\n\n${t.chatStopped}` : t.chatStopped;
                onUpdateMessages([...newHistory, { ...modelMsg, text: `${lastText}${stoppedSuffix}` }]);
            }
        } catch (err: any) {
            if (err?.name === 'AbortError' || controller.signal.aborted) {
                const stoppedSuffix = lastText ? `\n\n${t.chatStopped}` : t.chatStopped;
                onUpdateMessages([...newHistory, { ...modelMsg, text: `${lastText}${stoppedSuffix}` }]);
            } else {
                console.error('Chat stream failed:', err);
                onUpdateMessages([...newHistory, { ...modelMsg, text: '⚠ Error: failed to get a response. Please check your API settings.' }]);
            }
        } finally {
            if (abortRef.current === controller) abortRef.current = null;
            setLoading(false);
        }
    };

    const handleStop = () => {
        const controller = abortRef.current;
        if (!controller) return;
        // Reset UI immediately; provider loop polls signal between chunks and exits.
        abortRef.current = null;
        controller.abort();
        setLoading(false);
    };

    const handleSendInput = () => processSend(input);
    const handleChipClick = (prompt: string) => { if (!deleteMode) processSend(prompt); };

    const handleCopy = (text: string, id: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleSaveChip = (chip: CustomChip) => {
        const existing = allChips.find(c => c.id === chip.id);
        if (existing) {
            saveChips(allChips.map(c => c.id === chip.id ? { ...c, label: chip.label, prompt: chip.prompt } : c));
        } else {
            const newChip: UnifiedChip = { id: chip.id, label: chip.label, prompt: chip.prompt, isDefault: false };
            saveChips([...allChips, newChip]);
        }
    };

    const handleDeleteChip = (id: string) => {
        saveChips(allChips.filter(c => c.id !== id));
    };

    const openAddModal = () => { setEditingChip(null); setEditorOpen(true); setDeleteMode(false); };
    const openEditModal = (chip: UnifiedChip) => { setEditingChip({ id: chip.id, label: chip.label, prompt: chip.prompt }); setEditorOpen(true); setDeleteMode(false); };

    // Movement detection constants
    const LONG_PRESS_DURATION = 800;
    const MOVEMENT_THRESHOLD = 10;

    const handlePressStart = (e: React.MouseEvent | React.TouchEvent) => {
        if ('touches' in e) {
            pressStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else {
            pressStartPos.current = { x: e.clientX, y: e.clientY };
        }
        hasMoved.current = false;
        longPressTimer.current = setTimeout(() => {
            if (!hasMoved.current) setDeleteMode(true);
        }, LONG_PRESS_DURATION);
    };

    const handlePressMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!pressStartPos.current) return;
        let currentX: number, currentY: number;
        if ('touches' in e) {
            currentX = e.touches[0].clientX;
            currentY = e.touches[0].clientY;
        } else {
            currentX = e.clientX;
            currentY = e.clientY;
        }
        const dx = currentX - pressStartPos.current.x;
        const dy = currentY - pressStartPos.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > MOVEMENT_THRESHOLD) {
            hasMoved.current = true;
            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
            }
        }
    };

    const handlePressEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
        pressStartPos.current = null;
    };

    const handleExitDeleteMode = () => setDeleteMode(false);

    const handleDragStart = (e: React.DragEvent, chipId: string) => {
        // Stop propagation so a chip drag never bubbles up to outer dropzones
        // (e.g. the image grid's file-import overlay).
        e.stopPropagation();
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', chipId); } catch { /* WebKit edge cases */ }
        draggedIdRef.current = chipId;
        setDraggedId(chipId);
    };

    const handleDragOver = (e: React.DragEvent, chipId: string) => {
        // preventDefault is REQUIRED for the drop target to accept the drop.
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        if (chipId !== draggedIdRef.current) setDragOverId(chipId);
    };

    const handleDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        e.stopPropagation();
        const sourceId = draggedIdRef.current || e.dataTransfer.getData('text/plain');
        draggedIdRef.current = null;
        setDraggedId(null);
        setDragOverId(null);
        if (!sourceId || sourceId === targetId) return;
        const sourceIdx = allChips.findIndex(c => c.id === sourceId);
        const targetIdx = allChips.findIndex(c => c.id === targetId);
        if (sourceIdx === -1 || targetIdx === -1) return;
        const newChips = [...allChips];
        const [removed] = newChips.splice(sourceIdx, 1);
        newChips.splice(targetIdx, 0, removed);
        saveChips(newChips);
    };

    const handleDragEnd = (e: React.DragEvent) => {
        e.stopPropagation();
        draggedIdRef.current = null;
        setDraggedId(null);
        setDragOverId(null);
    };

    return (
        <div className="flex flex-col h-full bg-stone-50 dark:bg-stone-900 overflow-hidden transition-colors" onClick={deleteMode ? handleExitDeleteMode : undefined}>
            <div className="flex-1 overflow-y-auto px-6 pt-6 pb-10 space-y-6 scroll-smooth">
                {messages.map((msg, index) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-[fadeIn_0.3s_ease-out]`}>
                        <div className={`relative max-w-[90%] px-5 py-3.5 rounded-2xl shadow-sm text-[15px] leading-relaxed group ${msg.role === 'user' ? 'bg-stone-800 dark:bg-stone-700 text-white rounded-tr-none' : `bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 rounded-tl-none border border-stone-100 dark:border-stone-700 ${index > 0 ? 'pb-8' : ''}`}`}>
                            <MarkdownRenderer>{msg.text}</MarkdownRenderer>
                            {msg.role === 'model' && loading && msg.id === messages[messages.length - 1].id && msg.text === '' && (
                                <span className="inline-flex gap-1 ml-1">
                                    <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce"></span>
                                    <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce delay-75"></span>
                                    <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce delay-150"></span>
                                </span>
                            )}
                            {msg.role === 'model' && msg.text && index > 0 && (
                                <button onClick={() => handleCopy(msg.text, msg.id)} className="absolute bottom-2 right-2 p-1.5 text-stone-300 dark:text-stone-500 hover:text-softblue transition-colors rounded-lg hover:bg-stone-50 dark:hover:bg-stone-700 active:scale-95">
                                    {copiedId === msg.id ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
                                </button>
                            )}
                        </div>
                    </div>
                ))}
                <div ref={endRef} className="h-2" />
            </div>

            <div className="shrink-0 bg-white dark:bg-stone-900 border-t border-stone-100 dark:border-stone-800 z-50 pb-[env(safe-area-inset-bottom)] transition-colors" onClick={(e) => e.stopPropagation()}>
                {deleteMode && (
                    <div className="px-4 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs text-center font-medium">
                        点击标签上的 − 删除 | 点击空白处退出
                    </div>
                )}
                <div className="flex gap-2 px-4 py-3 overflow-x-auto no-scrollbar mask-gradient-right">
                    {allChips.map((chip) => (
                        <div
                            key={chip.id}
                            className="relative"
                            draggable={!loading}
                            onDragStart={(e) => handleDragStart(e, chip.id)}
                            onDragOver={(e) => handleDragOver(e, chip.id)}
                            onDrop={(e) => handleDrop(e, chip.id)}
                            onDragEnd={handleDragEnd}
                        >
                            <button
                                onClick={() => handleChipClick(chip.prompt)}
                                onMouseDown={handlePressStart}
                                onMouseMove={handlePressMove}
                                onMouseUp={handlePressEnd}
                                onMouseLeave={handlePressEnd}
                                onTouchStart={handlePressStart}
                                onTouchMove={handlePressMove}
                                onTouchEnd={handlePressEnd}
                                onContextMenu={(e) => { e.preventDefault(); openEditModal(chip); }}
                                disabled={loading}
                                className={`whitespace-nowrap px-4 py-1.5 text-xs font-bold rounded-full transition-all active:scale-95 disabled:opacity-50 cursor-grab active:cursor-grabbing
                                    ${chip.isDefault ? 'bg-stone-100 dark:bg-stone-800 hover:bg-sunny hover:text-stone-900 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-700 hover:border-sunny/50' : 'bg-coral/10 hover:bg-coral hover:text-white text-coral border border-coral/30 hover:border-coral'}
                                    ${dragOverId === chip.id ? 'ring-2 ring-softblue scale-105' : ''}
                                    ${draggedId === chip.id ? 'opacity-50' : ''}
                                    ${deleteMode ? 'animate-[wiggle_0.3s_ease-in-out_infinite]' : ''}`}
                            >
                                {chip.label}
                            </button>
                            {deleteMode && (
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteChip(chip.id); }} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-md hover:bg-red-600 active:scale-90 z-10">−</button>
                            )}
                        </div>
                    ))}
                    <button onClick={openAddModal} className="whitespace-nowrap px-3 py-1.5 bg-stone-50 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 text-xs font-bold rounded-full transition-all active:scale-95 border border-dashed border-stone-300 dark:border-stone-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    </button>
                </div>
                <div className="px-4 pb-2 pt-1 transition-all">
                    <div className="flex items-end gap-2 bg-stone-100/80 dark:bg-stone-800/80 p-2 rounded-[1.5rem] border border-stone-200 dark:border-stone-700 focus-within:border-stone-400 dark:focus-within:border-stone-500 focus-within:bg-white dark:focus-within:bg-stone-800 transition-all shadow-sm">
                        <textarea className="flex-1 bg-transparent px-4 py-3 outline-none text-stone-800 dark:text-stone-200 placeholder-stone-400 dark:placeholder-stone-600 resize-none max-h-32 min-h-[44px] text-sm" placeholder={t.chatPlaceholder} rows={1} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendInput(); } }} />
                        {loading ? (
                            <button
                                onClick={handleStop}
                                aria-label={t.chatStop}
                                title={t.chatStop}
                                className="w-10 h-10 mb-1 mr-1 bg-coral text-white rounded-full flex items-center justify-center shadow-md active:scale-95 transition-all hover:bg-red-400"
                            >
                                <span className="w-3 h-3 bg-white rounded-sm" />
                            </button>
                        ) : (
                            <button
                                onClick={handleSendInput}
                                disabled={!input.trim()}
                                className="w-10 h-10 mb-1 mr-1 bg-coral text-white rounded-full flex items-center justify-center shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none hover:bg-red-400"
                            >
                                <svg className="w-5 h-5 transform rotate-90 translate-x-[1px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19V5m0 0l-7 7m7-7l7 7" /></svg>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <ChipEditorModal isOpen={editorOpen} chip={editingChip} onSave={handleSaveChip} onDelete={handleDeleteChip} onClose={() => setEditorOpen(false)} />
            <style>{`@keyframes wiggle { 0%, 100% { transform: rotate(-1deg); } 50% { transform: rotate(1deg); } }`}</style>
        </div>
    );
};

export default ChatBot;