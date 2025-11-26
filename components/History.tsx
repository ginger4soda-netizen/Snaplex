import React, { useEffect, useState } from 'react';
import { HistoryItem } from '../types';
import { searchHistory } from '../services/geminiService';

interface Props {
  items: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onDeleteItems: (ids: string[]) => void;
  onMarkAsExported: (ids: string[]) => void;
}

const History: React.FC<Props> = ({ items = [], onSelect, onDeleteItems, onMarkAsExported }) => {
  const [filteredItems, setFilteredItems] = useState<HistoryItem[]>([]);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
      if (confirm(`Delete ${selectedIds.size} items?`)) {
          onDeleteItems(Array.from(selectedIds));
          setIsSelectionMode(false);
          setSelectedIds(new Set());
      }
  };

  const handleExport = () => {
      if (selectedIds.size === 0) return;
      
      const selectedItems = items.filter(item => selectedIds.has(item.id));
      const idsToMark = Array.from(selectedIds);
      
      // Generate HTML table for Excel (XLS)
      let tableContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
            <style>
                td { vertical-align: top; padding: 10px; border: 1px solid #ddd; white-space: pre-wrap; }
                th { background-color: #f0f0f0; font-weight: bold; padding: 10px; border: 1px solid #ddd; }
            </style>
        </head>
        <body>
            <table>
                <thead>
                    <tr>
                        <th>Image</th>
                        <th>Front Prompt (Original)</th>
                        <th>Back Prompt (Translated)</th>
                    </tr>
                </thead>
                <tbody>
      `;

      selectedItems.forEach(item => {
          const sp = item.analysis.structuredPrompts;
          
          let frontText = "";
          let backText = "";

          if (sp) {
              frontText = [
                  `[SUBJECT]:\n${sp.subject.original}`,
                  `[ENVIRONMENT]:\n${sp.environment.original}`,
                  `[COMPOSITION]:\n${sp.composition.original}`,
                  `[LIGHTING]:\n${sp.lighting.original}`,
                  `[MOOD]:\n${sp.mood.original}`,
                  `[STYLE]:\n${sp.style.original}`
              ].join("\n\n");

              backText = [
                  `[SUBJECT]:\n${sp.subject.translated}`,
                  `[ENVIRONMENT]:\n${sp.environment.translated}`,
                  `[COMPOSITION]:\n${sp.composition.translated}`,
                  `[LIGHTING]:\n${sp.lighting.translated}`,
                  `[MOOD]:\n${sp.mood.translated}`,
                  `[STYLE]:\n${sp.style.translated}`
              ].join("\n\n");
          } else {
              frontText = item.analysis.description || "";
          }

          tableContent += `
            <tr>
                <td style="height: 150px; width: 150px; text-align: center; vertical-align: middle;">
                    <img src="${item.imageUrl}" width="140" height="140" style="object-fit: cover; display: block; margin: auto;" />
                </td>
                <td>${frontText}</td>
                <td>${backText}</td>
            </tr>
          `;
      });

      tableContent += `</tbody></table></body></html>`;

      const blob = new Blob([tableContent], { type: 'application/vnd.ms-excel' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `snaplex_export_${Date.now()}.xls`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      onMarkAsExported(idsToMark);
      setIsSelectionMode(false);
      setSelectedIds(new Set());
  };

  const handleItemClick = (item: HistoryItem, e: React.MouseEvent) => {
      if (isSelectionMode) {
          toggleItemSelection(item.id, e);
      } else {
          onSelect(item);
      }
  };

  const renderGrid = (itemsToRender: HistoryItem[], title?: string) => {
      if (itemsToRender.length === 0) return null;
      return (
          <div className="mb-10">
              {title && (
                  <h3 className="text-stone-400 font-bold text-xs uppercase tracking-wider mb-4 border-b border-stone-200 pb-2">
                      {title} ({itemsToRender.length})
                  </h3>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {itemsToRender.map(item => (
                <div 
                    key={item.id}
                    onClick={(e) => handleItemClick(item, e)}
                    className={`
                        relative aspect-square rounded-3xl cursor-pointer overflow-hidden group
                        bg-stone-100 shadow-sm hover:shadow-md transition-all duration-300
                        ${isSelectionMode && selectedIds.has(item.id) ? 'ring-4 ring-softblue scale-95' : ''}
                        ${!item.lastExported ? 'ring-2 ring-transparent hover:ring-sunny/50' : 'opacity-90'}
                    `}
                >
                    <img src={item.imageUrl} alt="Thumbnail" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    
                    {!item.read && !isSelectionMode && (
                        <div className="absolute top-3 right-3 w-3 h-3 bg-coral rounded-full shadow-sm ring-2 ring-white animate-pulse"></div>
                    )}

                    {isSelectionMode && (
                        <div className={`absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors z-10 ${selectedIds.has(item.id) ? 'bg-softblue border-softblue' : 'border-white bg-black/20 backdrop-blur-sm'}`}>
                            {selectedIds.has(item.id) && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                        </div>
                    )}
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                        <span className="text-white text-xs font-bold tracking-wide block">
                            {new Date(item.timestamp).toLocaleDateString()}
                        </span>
                        {item.lastExported && (
                            <span className="text-stone-300 text-[10px] block mt-1">
                                Exported: {new Date(item.lastExported).toLocaleDateString()}
                            </span>
                        )}
                    </div>
                </div>
                ))}
            </div>
          </div>
      );
  };

  const safeFilteredItems = filteredItems || [];
  const unexportedItems = safeFilteredItems.filter(i => !i.lastExported);
  const exportedItems = safeFilteredItems.filter(i => i.lastExported);

  return (
    <div className="p-4 animate-[fadeIn_0.3s_ease-out] max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-stone-800">Your Library</h2>
          <button onClick={toggleSelectionMode} className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors ${isSelectionMode ? 'bg-stone-200 text-stone-800' : 'text-stone-500 hover:bg-stone-100'}`}>
              {isSelectionMode ? 'Cancel' : 'Select'}
          </button>
      </div>
      
      {!isSelectionMode ? (
        <div className="mb-8 flex gap-2">
            <input 
              type="text" 
              value={query} 
              onChange={(e) => setQuery(e.target.value)} 
              placeholder="Search your snaps..." 
              className="flex-1 bg-white border border-stone-200 rounded-xl px-4 py-3 outline-none focus:border-softblue transition-colors shadow-sm" 
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()} 
            />
            
            {/* --- 修改后的搜索按钮 --- */}
            <button 
              onClick={handleSearch} 
              disabled={searching} 
              className="bg-stone-800 text-white px-6 rounded-xl font-bold disabled:opacity-50 shadow-md hover:bg-stone-700 transition-colors min-w-[80px] flex items-center justify-center"
            >
                {searching ? (
                    // 这里是三色圆点跳动动画
                    <div className="flex gap-1.5 items-center">
                        <div className="w-2 h-2 bg-coral rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-sunny rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-softblue rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                ) : 'Find'}
            </button>
        </div>
      ) : (
          <div className="mb-8 flex flex-col sm:flex-row justify-between items-center bg-stone-100 p-3 rounded-xl border border-stone-200 gap-3">
             <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto">
                 <button onClick={handleSelectAll} className="text-stone-500 hover:text-stone-800 font-bold text-sm px-2 whitespace-nowrap">
                    {selectedIds.size === safeFilteredItems.length ? 'Deselect All' : 'Select All'}
                 </button>
                 <span className="text-stone-400">|</span>
                 <button onClick={handleSelectUnexported} className="text-softblue hover:text-stone-800 font-bold text-sm px-2 whitespace-nowrap">
                    Select New ({unexportedItems.length})
                 </button>
                 <span className="text-stone-400">|</span>
                 <span className="font-bold text-stone-600 whitespace-nowrap">{selectedIds.size} selected</span>
             </div>
             
             <div className="flex gap-2 w-full sm:w-auto">
                 <button onClick={handleExport} disabled={selectedIds.size === 0} className="flex-1 sm:flex-none bg-softblue text-white px-4 py-2 rounded-lg font-bold disabled:opacity-50 disabled:bg-stone-300 shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2">
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                     Export
                 </button>
                 <button onClick={handleBatchDelete} disabled={selectedIds.size === 0} className="flex-1 sm:flex-none bg-coral text-white px-4 py-2 rounded-lg font-bold disabled:opacity-50 disabled:bg-stone-300 shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2">
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                     Delete
                 </button>
             </div>
          </div>
      )}

      {items.length === 0 ? (
        <div className="p-10 text-center text-stone-400">
            <p>No history yet. Snap a photo!</p>
        </div>
      ) : (
        <>
            {renderGrid(unexportedItems, "New Snaps")}
            {unexportedItems.length > 0 && exportedItems.length > 0 && (
                <div className="h-px bg-stone-200 my-8" />
            )}
            {renderGrid(exportedItems, "Exported Library")}
            {safeFilteredItems.length === 0 && !searching && (
                <p className="text-center text-stone-400 col-span-full py-10">No matches found.</p>
            )}
        </>
      )}
    </div>
  );
};

export default History;