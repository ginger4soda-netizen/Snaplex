import React, { useEffect, useState } from 'react';
import { HistoryItem } from '../types';
import { searchHistory } from '../services/geminiService';
import { getTranslation } from '../translations';

interface Props {
    items: HistoryItem[];
    onSelect: (item: HistoryItem) => void;
    onDeleteItems: (ids: string[]) => void;
    onMarkAsExported: (ids: string[]) => void;
    systemLanguage?: string;
}

const History: React.FC<Props> = ({ items = [], onSelect, onDeleteItems, onMarkAsExported, systemLanguage }) => {
    const [filteredItems, setFilteredItems] = useState<HistoryItem[]>([]);
    const [query, setQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    // New State for Grid Size (4-8)
    const [gridCols, setGridCols] = useState(4);

    const t = getTranslation(systemLanguage);

    useEffect(() => {
        if (!query) {
            setFilteredItems(items);
        }
    }, [items, query]);

    const handleSearch = async () => {
        if (!query.trim()) {
            setFilteredItems(items);
            return;
        }
        setSearching(true);
        try {
            const ids = await searchHistory(query, items);
            const results = items.filter(item => ids.includes(item.id));
            setFilteredItems(results);
        } catch (error) {
            console.error("Search failed", error);
        } finally {
            setSearching(false);
        }
    };

    const toggleSelectionMode = () => {
        setIsSelectionMode(!isSelectionMode);
        setSelectedIds(new Set());
    };

    const toggleItemSelection = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handleSelectAll = () => {
        if (selectedIds.size === filteredItems.length) {
            setSelectedIds(new Set());
        } else {
            const allIds = new Set(filteredItems.map(item => item.id));
            setSelectedIds(allIds);
        }
    };

    const handleSelectUnexported = () => {
        const unexportedIds = filteredItems.filter(i => !i.lastExported).map(i => i.id);
        setSelectedIds(new Set(unexportedIds));
    };

    const handleBatchDelete = () => {
        if (selectedIds.size === 0) return;
        if (confirm(t.confirmDelete)) {
            onDeleteItems(Array.from(selectedIds));
            setIsSelectionMode(false);
            setSelectedIds(new Set());
        }
    };

    // ✅ 核心修复：优化 Excel 导出逻辑
    const handleExport = () => {
        if (selectedIds.size === 0) return;
        const selectedItems = items.filter(item => selectedIds.has(item.id));
        const idsToMark = Array.from(selectedIds);

        // 1. 定义样式：移除 td 的 height 限制，增加 vertical-align: top 和 white-space: pre-wrap
        let tableContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
            <style>
                body { font-family: sans-serif; }
                table { border-collapse: collapse; width: 100%; }
                th { background-color: #f0f0f0; border: 1px solid #999; padding: 10px; text-align: left; }
                td { border: 1px solid #999; padding: 10px; vertical-align: top; }
                .img-cell { width: 160px; text-align: center; }
                .text-cell { width: 400px; white-space: pre-wrap; } /* 关键：强制换行且定宽 */
            </style>
        </head>
        <body>
            <table>
                <thead>
                    <tr>
                        <th>Image</th>
                        <th>Front Prompt</th>
                        <th>Back Prompt</th>
                    </tr>
                </thead>
                <tbody>
      `;

        selectedItems.forEach(item => {
            const sp = item.analysis.structuredPrompts;
            let frontText = "", backText = "";

            // 使用 HTML <br> 换行，确保 Excel 能识别
            if (sp) {
                frontText = `[SUBJECT]:<br>${sp.subject.original}<br><br>[ENVIRONMENT]:<br>${sp.environment.original}<br><br>[COMPOSITION]:<br>${sp.composition.original}<br><br>[LIGHTING]:<br>${sp.lighting.original}<br><br>[MOOD]:<br>${sp.mood.original}<br><br>[STYLE]:<br>${sp.style.original}`;
                backText = `[SUBJECT]:<br>${sp.subject.translated}<br><br>[ENVIRONMENT]:<br>${sp.environment.translated}<br><br>[COMPOSITION]:<br>${sp.composition.translated}<br><br>[LIGHTING]:<br>${sp.lighting.translated}<br><br>[MOOD]:<br>${sp.mood.translated}<br><br>[STYLE]:<br>${sp.style.translated}`;
            } else {
                frontText = item.analysis.description || "";
                backText = "N/A";
            }

            // 2. 构建行：图片单元格不设高度，文字单元格应用 .text-cell 样式
            tableContent += `
            <tr>
                <td class="img-cell">
                    <img src="${item.imageUrl}" width="150" style="object-fit: contain; max-height: 300px; display: block; margin: 0 auto;" />
                    <br/><br/>
                    <span style="color: #666; font-size: 10px;">${new Date(item.timestamp).toLocaleDateString()}</span>
                </td>
                <td class="text-cell">${frontText}</td>
                <td class="text-cell">${backText}</td>
            </tr>
          `;
        });

        tableContent += `</tbody></table></body></html>`;

        const blob = new Blob([tableContent], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `snaplex_export_${Date.now()}.xls`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        onMarkAsExported(idsToMark);
        setIsSelectionMode(false);
        setSelectedIds(new Set());
    };

    const handleItemClick = (item: HistoryItem, e: React.MouseEvent) => {
        if (isSelectionMode) toggleItemSelection(item.id, e);
        else onSelect(item);
    };

    const renderGrid = (itemsToRender: HistoryItem[], title?: string) => {
        if (itemsToRender.length === 0) return null;

        // Safe Grid Class Mapping
        const gridClass = {
            4: 'md:grid-cols-4',
            5: 'md:grid-cols-5',
            6: 'md:grid-cols-6',
            7: 'md:grid-cols-7',
            8: 'md:grid-cols-8',
        }[gridCols] || 'md:grid-cols-4';

        return (
            <div className="mb-10">
                <div className="flex justify-between items-end mb-4 border-b border-stone-200 pb-2">
                    {title && (
                        <h3 className="text-stone-400 font-bold text-xs uppercase tracking-wider">
                            {title} ({itemsToRender.length})
                        </h3>
                    )}
                    {/* Grid Size Slider UI */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-stone-400 font-bold">SIZE</span>
                        <input
                            type="range"
                            min="4"
                            max="8"
                            step="1"
                            value={gridCols}
                            onChange={(e) => setGridCols(parseInt(e.target.value))}
                            className="w-20 h-1 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-softblue"
                        />
                        <span className="text-[10px] text-stone-400 font-mono w-3 text-right">{gridCols}</span>
                    </div>
                </div>

                <div className={`grid grid-cols-2 sm:grid-cols-3 ${gridClass} gap-4`}>
                    {itemsToRender.map(item => (
                        <div
                            key={item.id} onClick={(e) => handleItemClick(item, e)}
                            className={`relative aspect-square rounded-3xl cursor-pointer overflow-hidden group bg-stone-100 shadow-sm hover:shadow-md transition-all duration-300 ${isSelectionMode && selectedIds.has(item.id) ? 'ring-4 ring-softblue scale-95' : ''} ${!item.lastExported ? 'ring-2 ring-transparent hover:ring-sunny/50' : 'opacity-90'}`}
                        >
                            <img src={item.imageUrl} alt="Thumbnail" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                            {!item.read && !isSelectionMode && <div className="absolute top-3 right-3 w-3 h-3 bg-coral rounded-full shadow-sm ring-2 ring-white animate-pulse"></div>}
                            {isSelectionMode && (
                                <div className={`absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors z-10 ${selectedIds.has(item.id) ? 'bg-softblue border-softblue' : 'border-white bg-black/20 backdrop-blur-sm'}`}>
                                    {selectedIds.has(item.id) && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                                <span className="text-white text-xs font-bold tracking-wide block">{new Date(item.timestamp).toLocaleDateString()}</span>
                                {item.lastExported && <span className="text-stone-300 text-[10px] block mt-1">Exported</span>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // Get recent items (sorted by last viewed time, fallback to creation time)
    const recentItems = items
        .filter(i => i.read)
        .sort((a, b) => (b.lastViewedAt || b.timestamp) - (a.lastViewedAt || a.timestamp))
        .slice(0, 3);

    const safeFilteredItems = filteredItems || [];
    const unexportedItems = safeFilteredItems.filter(i => !i.lastExported);
    const exportedItems = safeFilteredItems.filter(i => i.lastExported);

    return (
        <div className="min-h-screen pt-20 pb-10 animate-[fadeIn_0.3s_ease-out]">
            {/* Desktop: Full-screen grid layout */}
            <div className="hidden md:block px-8 max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-3xl font-black text-stone-800 tracking-tight">{t.libraryTitle}</h2>
                    <button onClick={toggleSelectionMode} className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors ${isSelectionMode ? 'bg-stone-200 text-stone-800' : 'text-stone-500 hover:bg-stone-100'}`}>
                        {isSelectionMode ? t.btnCancel : t.btnSelect}
                    </button>
                </div>

                {/* Search Bar */}
                {!isSelectionMode ? (
                    <div className="mb-6 flex gap-2">
                        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.searchPlaceholder} className="flex-1 bg-white border border-stone-200 rounded-xl px-4 py-3 outline-none focus:border-softblue transition-colors shadow-sm" onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
                        <button onClick={handleSearch} disabled={searching} className="bg-stone-800 text-white px-6 rounded-xl font-bold disabled:opacity-50 shadow-md hover:bg-stone-700 transition-colors min-w-[80px] flex items-center justify-center">
                            {searching ? (
                                <div className="flex gap-1.5 items-center">
                                    <div className="w-2 h-2 bg-coral rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                    <div className="w-2 h-2 bg-sunny rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                    <div className="w-2 h-2 bg-softblue rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                </div>
                            ) : t.btnFind}
                        </button>
                    </div>
                ) : (
                    <div className="mb-6 flex flex-wrap justify-between items-center bg-stone-100 p-3 rounded-xl border border-stone-200 gap-3">
                        <div className="flex items-center gap-3">
                            <button onClick={handleSelectAll} className="text-stone-500 hover:text-stone-800 font-bold text-sm px-2 whitespace-nowrap">{selectedIds.size === safeFilteredItems.length ? t.btnDeselectAll : t.btnSelectAll}</button>
                            <span className="text-stone-400">|</span>
                            <button onClick={handleSelectUnexported} className="text-softblue hover:text-stone-800 font-bold text-sm px-2 whitespace-nowrap">{t.btnSelectNew} ({unexportedItems.length})</button>
                            <span className="text-stone-400">|</span>
                            <span className="font-bold text-stone-600 whitespace-nowrap">{selectedIds.size} {t.txtSelected}</span>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleExport} disabled={selectedIds.size === 0} className="bg-softblue text-white px-4 py-2 rounded-lg font-bold disabled:opacity-50 disabled:bg-stone-300 shadow-sm active:scale-95 transition-all">{t.btnExport}</button>
                            <button onClick={handleBatchDelete} disabled={selectedIds.size === 0} className="bg-coral text-white px-4 py-2 rounded-lg font-bold disabled:opacity-50 disabled:bg-stone-300 shadow-sm active:scale-95 transition-all">{t.btnDelete}</button>
                        </div>
                    </div>
                )}

                {/* Split Layout: Recent (Left) + History (Right) */}
                <div className="flex gap-6">
                    {/* Left Column: Recent */}
                    {recentItems.length > 0 && !isSelectionMode && (
                        <div className="w-64 flex-shrink-0">
                            <h3 className="text-stone-400 font-bold text-xs uppercase tracking-wider mb-4 border-b border-stone-200 pb-2">
                                {t.sectionRecent}
                            </h3>
                            <div className="p-4 bg-sunny/10 rounded-[1.5rem] shadow-[6px_6px_0px_0px_rgba(255,209,102,0.3)] sticky top-24">
                                <div className="flex flex-col gap-3">
                                    {recentItems.map(item => (
                                        <div
                                            key={item.id}
                                            onClick={() => onSelect(item)}
                                            className="w-full aspect-square rounded-xl overflow-hidden cursor-pointer group relative border-2 border-stone-200 hover:border-softblue transition-colors"
                                        >
                                            <img src={item.imageUrl} alt="Recent" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Right Column: History Grid */}
                    <div className="flex-1">
                        {items.length === 0 ? (
                            <div className="p-10 text-center text-stone-400"><p>{t.emptyHistory}</p></div>
                        ) : (
                            <>
                                {renderGrid(unexportedItems, t.sectionNew)}
                                {unexportedItems.length > 0 && exportedItems.length > 0 && <div className="h-px bg-stone-200 my-8" />}
                                {renderGrid(exportedItems, t.sectionExported)}
                                {safeFilteredItems.length === 0 && !searching && <p className="text-center text-stone-400 col-span-full py-10">{t.noMatches}</p>}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile: Original centered layout */}
            <div className="md:hidden p-6 max-w-screen-md mx-auto">
                <div className="flex justify-between items-center mb-6 px-1">
                    <h2 className="text-2xl font-black text-stone-800 tracking-tight">{t.libraryTitle}</h2>
                    <button onClick={toggleSelectionMode} className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors ${isSelectionMode ? 'bg-stone-200 text-stone-800' : 'text-stone-500 hover:bg-stone-100'}`}>
                        {isSelectionMode ? t.btnCancel : t.btnSelect}
                    </button>
                </div>

                {!isSelectionMode ? (
                    <div className="mb-8 flex gap-2">
                        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.searchPlaceholder} className="flex-1 bg-white border border-stone-200 rounded-xl px-4 py-3 outline-none focus:border-softblue transition-colors shadow-sm" onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
                        <button onClick={handleSearch} disabled={searching} className="bg-stone-800 text-white px-6 rounded-xl font-bold disabled:opacity-50 shadow-md hover:bg-stone-700 transition-colors min-w-[80px] flex items-center justify-center">
                            {searching ? (
                                <div className="flex gap-1.5 items-center">
                                    <div className="w-2 h-2 bg-coral rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                    <div className="w-2 h-2 bg-sunny rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                    <div className="w-2 h-2 bg-softblue rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                </div>
                            ) : t.btnFind}
                        </button>
                    </div>
                ) : (
                    <div className="mb-8 flex flex-col gap-3 bg-stone-100 p-3 rounded-xl border border-stone-200">
                        <div className="flex items-center gap-3 overflow-x-auto">
                            <button onClick={handleSelectAll} className="text-stone-500 hover:text-stone-800 font-bold text-sm px-2 whitespace-nowrap">{selectedIds.size === safeFilteredItems.length ? t.btnDeselectAll : t.btnSelectAll}</button>
                            <span className="text-stone-400">|</span>
                            <button onClick={handleSelectUnexported} className="text-softblue hover:text-stone-800 font-bold text-sm px-2 whitespace-nowrap">{t.btnSelectNew} ({unexportedItems.length})</button>
                            <span className="text-stone-400">|</span>
                            <span className="font-bold text-stone-600 whitespace-nowrap">{selectedIds.size} {t.txtSelected}</span>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleExport} disabled={selectedIds.size === 0} className="flex-1 bg-softblue text-white px-4 py-2 rounded-lg font-bold disabled:opacity-50 disabled:bg-stone-300 shadow-sm">{t.btnExport}</button>
                            <button onClick={handleBatchDelete} disabled={selectedIds.size === 0} className="flex-1 bg-coral text-white px-4 py-2 rounded-lg font-bold disabled:opacity-50 disabled:bg-stone-300 shadow-sm">{t.btnDelete}</button>
                        </div>
                    </div>
                )}

                {items.length === 0 ? (
                    <div className="p-10 text-center text-stone-400"><p>{t.emptyHistory}</p></div>
                ) : (
                    <>
                        {renderGrid(unexportedItems, t.sectionNew)}
                        {unexportedItems.length > 0 && exportedItems.length > 0 && <div className="h-px bg-stone-200 my-8" />}
                        {renderGrid(exportedItems, t.sectionExported)}
                        {safeFilteredItems.length === 0 && !searching && <p className="text-center text-stone-400 col-span-full py-10">{t.noMatches}</p>}
                    </>
                )}
            </div>
        </div>
    );
};

export default History;