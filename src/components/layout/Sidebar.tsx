import React, { useEffect, useState, useRef } from 'react';
import FolderTree from '../folders/FolderTree';
import { useTauriIPC } from '@/hooks/useTauriIPC';
import { invoke } from '@tauri-apps/api/core';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  currentFolderId?: string;
  onFolderSelect: (folderId: string | undefined) => void;
  onNavigate?: (mode: string) => void;
  onImagesChanged?: () => void;
  refreshTrigger?: number;
}

type SnaplexDragPayload = {
  ids: string[];
  sourceFolder: string;
  startedAt: number;
  lastX?: number;
  lastY?: number;
};

const readImageDragPayload = (e: React.DragEvent): SnaplexDragPayload | null => {
  const raw =
    e.dataTransfer.getData('application/snaplex-images') ||
    e.dataTransfer.getData('application/json') ||
    e.dataTransfer.getData('text/plain').replace(/^snaplex-images:/, '');

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const ids = Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === 'string')
        : [];
      if (ids.length > 0) {
        return {
          ids,
          sourceFolder: e.dataTransfer.getData('application/snaplex-source-folder'),
          startedAt: Date.now(),
        };
      }
    } catch (err) {
      console.error('Invalid drag payload:', err);
    }
  }

  const fallback = (window as Window & { __SNAPLEX_IMAGE_DRAG__?: SnaplexDragPayload }).__SNAPLEX_IMAGE_DRAG__;
  if (!fallback || Date.now() - fallback.startedAt > 10000 || fallback.ids.length === 0) {
    return null;
  }
  return fallback;
};

const logBatchDebug = (message: string) => {
  invoke('debug_log', { message }).catch(() => {});
};

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggleCollapse, currentFolderId, onFolderSelect, onNavigate, onImagesChanged, refreshTrigger: externalRefreshTrigger = 0 }) => {
  const { createFolder, moveImages, removeImagesFromFolders, linkImageToFolder } = useTauriIPC();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  useEffect(() => {
    const handleInternalDragOver = (event: Event) => {
      const detail = (event as CustomEvent<{ folderId: string | null }>).detail;
      setDragOverFolderId(detail?.folderId ?? null);
    };
    window.addEventListener('snaplex-internal-drag-over-folder', handleInternalDragOver);
    return () => window.removeEventListener('snaplex-internal-drag-over-folder', handleInternalDragOver);
  }, []);

  // Hover popup state for folders in collapsed mode
  const [showFolderPopup, setShowFolderPopup] = useState(false);
  const folderPopupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFolderMouseEnter = () => {
    if (folderPopupTimerRef.current) clearTimeout(folderPopupTimerRef.current);
    setShowFolderPopup(true);
  };

  const handleFolderMouseLeave = () => {
    folderPopupTimerRef.current = setTimeout(() => setShowFolderPopup(false), 200);
  };

  const handleFolderDrop = async (targetFolderId: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverFolderId(null);
    const payload = readImageDragPayload(e);
    if (!payload) return;
    const imageIds = payload.ids;
    const sourceFolder = payload.sourceFolder;
    logBatchDebug(`folder-drop target=${targetFolderId} ids=${imageIds.length} source=${sourceFolder || 'none'}`);
    const isAltHeld = e.altKey;
    // From All Images or Favorites: always link. From a specific folder: default = move, Alt = link
    const shouldLink = !sourceFolder || sourceFolder === '__favorites__' || isAltHeld;
    try {
      if (shouldLink) {
        for (const id of imageIds) {
          await linkImageToFolder(id, targetFolderId);
        }
      } else {
        await moveImages(imageIds, targetFolderId);
      }
      setRefreshTrigger(prev => prev + 1);
      onImagesChanged?.();
      window.dispatchEvent(new Event('snaplex-clear-selection'));
    } catch (err) {
      console.error('Drag-to-folder failed:', err);
    } finally {
      delete (window as Window & { __SNAPLEX_IMAGE_DRAG__?: SnaplexDragPayload }).__SNAPLEX_IMAGE_DRAG__;
    }
  };

  const handleAllImagesDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolderId('__all__');
  };

  const handleAllImagesDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverFolderId(null);
    const payload = readImageDragPayload(e);
    if (!payload) return;
    logBatchDebug(`all-images-drop ids=${payload.ids.length} source=${payload.sourceFolder || 'none'}`);
    try {
      await removeImagesFromFolders(payload.ids);
      setRefreshTrigger(prev => prev + 1);
      onImagesChanged?.();
      window.dispatchEvent(new Event('snaplex-clear-selection'));
    } catch (err) {
      console.error('Drag-to-all-images failed:', err);
    } finally {
      delete (window as Window & { __SNAPLEX_IMAGE_DRAG__?: SnaplexDragPayload }).__SNAPLEX_IMAGE_DRAG__;
    }
  };

  const handleCreateFolder = () => {
    setIsCreating(true);
    setNewFolderName('New Folder');
    setTimeout(() => inputRef.current?.select(), 50);
  };

  const submitCreateRef = React.useRef(false);
  const submitCreate = async () => {
    if (submitCreateRef.current) return;
    if (!newFolderName.trim()) {
      setIsCreating(false);
      return;
    }
    submitCreateRef.current = true;
    try {
      await createFolder(newFolderName.trim(), null);
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error('Failed to create folder', err);
    }
    setIsCreating(false);
    setNewFolderName('');
    submitCreateRef.current = false;
  };

  const iconBtnClass = "w-10 h-10 mx-auto flex items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors";

  // ─── Collapsed icon bar ───
  if (collapsed) {
    return (
      <div className="flex flex-col h-full items-center py-3 bg-cream dark:bg-stone-900 relative">
        {/* Logo — click to expand */}
        <button
          onClick={onToggleCollapse}
          className="w-10 h-10 mb-3 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-colors"
          title="Expand sidebar"
        >
          S
        </button>

        {/* All Images */}
        <button
          data-folder-id="__all__"
          onClick={() => onFolderSelect(undefined)}
          onDragOver={handleAllImagesDragOver}
          onDragLeave={() => setDragOverFolderId(null)}
          onDrop={handleAllImagesDrop}
          className={iconBtnClass + (dragOverFolderId === '__all__' ? ' bg-blue-100 dark:bg-blue-900/30 ring-2 ring-blue-400 text-blue-600 dark:text-blue-400' : !currentFolderId ? ' bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : '')}
          title="All Images"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
        </button>

        {/* Favorites */}
        <button
          onClick={() => onFolderSelect('__favorites__')}
          className={iconBtnClass + (currentFolderId === '__favorites__' ? ' bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : '')}
          title="Favorites"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.382-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
        </button>

        {/* Divider */}
        <div className="mx-3 my-1 w-6 border-t border-stone-200 dark:border-stone-800" />

        {/* Folders — with hover popup */}
        <div
          className="relative"
          onMouseEnter={handleFolderMouseEnter}
          onMouseLeave={handleFolderMouseLeave}
        >
          <button
            className={iconBtnClass}
            title="Folders"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
          </button>

          {/* Folder hover popup */}
          {showFolderPopup && (
            <div
              className="absolute left-14 top-0 z-50 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg shadow-xl p-2 min-w-[200px]"
              onMouseEnter={handleFolderMouseEnter}
              onMouseLeave={handleFolderMouseLeave}
            >
              <h3 className="px-2 mb-1 text-xs font-semibold text-stone-400 uppercase">Folders</h3>
              <FolderTree
                currentFolderId={currentFolderId}
                onFolderSelect={onFolderSelect}
                refreshTrigger={refreshTrigger + externalRefreshTrigger}
                onFolderDrop={handleFolderDrop}
                dragOverFolderId={dragOverFolderId}
                onDragOverFolder={setDragOverFolderId}
              />
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="mx-3 my-1 w-6 border-t border-stone-200 dark:border-stone-800" />

        {/* Style Printer */}
        <button
          onClick={() => onNavigate?.('printer')}
          className={iconBtnClass}
          title="Style Printer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Settings */}
        <button
          onClick={() => onNavigate?.('settings')}
          className={iconBtnClass}
          title="Settings"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 002.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        </button>

        {/* About */}
        <button
          onClick={() => onNavigate?.('about')}
          className={iconBtnClass + ' mb-1'}
          title="About"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </button>
      </div>
    );
  }

  // ─── Expanded state ───
  return (
    <div className="flex flex-col h-full bg-cream dark:bg-stone-900">
      {/* App Header / Logo + Collapse button */}
      <div className="p-4 flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">S</div>
        <h1 className="font-bold text-lg tracking-tight dark:text-white">Snaplex</h1>
        <div className="flex-1" />
        <button
          onClick={onToggleCollapse}
          className="p-1 rounded text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          title="Collapse sidebar"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
        </button>
      </div>

      {/* Library + Folders + Tools — scrollable area */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
        {/* Library Section */}
        <div>
          <h2 className="px-3 mb-1 text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">Library</h2>
          <div className="space-y-0.5">
            <button
              data-folder-id="__all__"
              onClick={() => onFolderSelect(undefined)}
              onDragOver={handleAllImagesDragOver}
              onDragLeave={() => setDragOverFolderId(null)}
              onDrop={handleAllImagesDrop}
              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${dragOverFolderId === '__all__' ? 'bg-blue-100 dark:bg-blue-900/30 ring-2 ring-blue-400 text-blue-600 dark:text-blue-400 font-medium' : !currentFolderId ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium' : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              <span>All Images</span>
            </button>
            <button
              onClick={() => onFolderSelect('__favorites__')}
              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${currentFolderId === '__favorites__' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium' : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.382-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
              <span>Favorites</span>
            </button>
          </div>
        </div>

        {/* Folders Section */}
        <div>
          <div className="flex items-center justify-between px-3 mb-1">
            <h2 className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">Folders</h2>
            <button
              onClick={handleCreateFolder}
              className="p-0.5 rounded text-stone-400 hover:text-blue-500 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              title="New Folder"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          {isCreating && (
            <div className="flex items-center gap-1 px-4 py-1">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <input
                ref={inputRef}
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onBlur={submitCreate}
                onKeyDown={(e) => { if (e.key === 'Enter') submitCreate(); if (e.key === 'Escape') { setIsCreating(false); setNewFolderName(''); } }}
                className="flex-1 text-sm bg-transparent border border-blue-400 rounded px-1 py-0.5 outline-none dark:text-white"
              />
            </div>
          )}
          <FolderTree
            currentFolderId={currentFolderId}
            onFolderSelect={onFolderSelect}
            refreshTrigger={refreshTrigger + externalRefreshTrigger}
            onFolderDrop={handleFolderDrop}
            dragOverFolderId={dragOverFolderId}
            onDragOverFolder={setDragOverFolderId}
          />
        </div>

        {/* Tools Section — moved from bottom to after folders */}
        <div>
          <h2 className="px-3 mb-1 text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">Tools</h2>
          <div className="space-y-0.5">
            <button
              onClick={() => onNavigate?.('printer')}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              <span>Style Printer</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom: Settings, About — pinned with border-top separator */}
      <div className="border-t border-stone-200 dark:border-stone-800 px-2 py-2 space-y-0.5">
        <button
          onClick={() => onNavigate?.('settings')}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 002.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          <span>Settings</span>
        </button>
        <button
          onClick={() => onNavigate?.('about')}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>About</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
