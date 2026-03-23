import React, { useState, useEffect } from 'react';
import { CustomChip } from '../types';

interface Props {
    isOpen: boolean;
    chip?: CustomChip | null;
    onSave: (chip: CustomChip) => void;
    onDelete?: (id: string) => void;
    onClose: () => void;
}

const ChipEditorModal: React.FC<Props> = ({ isOpen, chip, onSave, onDelete, onClose }) => {
    const [label, setLabel] = useState('');
    const [prompt, setPrompt] = useState('');

    useEffect(() => {
        if (chip) {
            setLabel(chip.label);
            setPrompt(chip.prompt);
        } else {
            setLabel('');
            setPrompt('');
        }
    }, [chip, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (!label.trim() || !prompt.trim()) return;
        onSave({
            id: chip?.id || Date.now().toString(),
            label: label.trim(),
            prompt: prompt.trim()
        });
        onClose();
    };

    const handleDelete = () => {
        if (chip && onDelete) {
            onDelete(chip.id);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-[fadeIn_0.2s]">
            <div className="bg-white rounded-2xl shadow-xl w-[90%] max-w-md p-6 animate-[slideUp_0.3s]">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-stone-800">
                        {chip ? '编辑预设' : '添加预设'}
                    </h3>
                    <button onClick={onClose} className="text-stone-400 hover:text-stone-800 p-1">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-stone-400 font-bold text-[10px] uppercase tracking-wider mb-2">
                            标签名称
                        </label>
                        <input
                            type="text"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            placeholder="例如：艺术风格"
                            className="w-full bg-stone-100 border border-stone-200 rounded-xl px-4 py-3 text-stone-700 outline-none focus:border-softblue"
                        />
                    </div>

                    <div>
                        <label className="block text-stone-400 font-bold text-[10px] uppercase tracking-wider mb-2">
                            预设问题
                        </label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="例如：分析这张图片的艺术风格"
                            rows={3}
                            className="w-full bg-stone-100 border border-stone-200 rounded-xl px-4 py-3 text-stone-700 outline-none focus:border-softblue resize-none"
                        />
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    {chip && onDelete && (
                        <button
                            onClick={handleDelete}
                            className="px-4 py-2.5 text-red-500 font-bold text-sm rounded-xl hover:bg-red-50 transition-colors"
                        >
                            删除
                        </button>
                    )}
                    <div className="flex-1" />
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-stone-100 text-stone-600 font-bold text-sm rounded-xl hover:bg-stone-200 transition-colors"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!label.trim() || !prompt.trim()}
                        className="px-6 py-2.5 bg-stone-800 text-white font-bold text-sm rounded-xl hover:bg-stone-700 transition-colors disabled:opacity-50"
                    >
                        保存
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChipEditorModal;
