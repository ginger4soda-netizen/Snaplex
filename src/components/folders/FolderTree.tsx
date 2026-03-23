import React, { useEffect, useState, useCallback } from 'react';
import { useTauriIPC } from '@/hooks/useTauriIPC';
import { FolderNode } from '@/types';
import ContextMenu, { MenuItem } from '@/components/common/ContextMenu';

interface FolderTreeProps {
  currentFolderId?: string;
  onFolderSelect: (folderId: string | undefined) => void;
  refreshTrigger?: number;
}

const FolderTree: React.FC<FolderTreeProps> = ({ currentFolderId, onFolderSelect, refreshTrigger }) => {
  const { getFolderTree, createFolder, renameFolder, deleteFolder } = useTauriIPC();
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [creatingParentId, setCreatingParentId] = useState<string | null | undefined>(undefined);
  const [newFolderName, setNewFolderName] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; folderId: string; folderName: string } | null>(null);

  const loadFolders = useCallback(async () => {
    try {
      const tree = await getFolderTree();
      setFolders(tree);
    } catch (err) {
      console.error("Failed to load folder tree", err);
    }
  }, [getFolderTree]);

  useEffect(() => {
    loadFolders();
  }, [loadFolders, refreshTrigger]);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const handleCreateFolder = async (parentId: string | null) => {
    setCreatingParentId(parentId);
    setNewFolderName('New Folder');
    if (parentId) {
      setExpandedIds(prev => new Set([...prev, parentId]));
    }
  };

  const submitCreate = async () => {
    if (!newFolderName.trim()) {
      setCreatingParentId(undefined);
      return;
    }
    try {
      await createFolder(newFolderName.trim(), creatingParentId ?? null);
      await loadFolders();
    } catch (err) {
      console.error('Failed to create folder', err);
    }
    setCreatingParentId(undefined);
    setNewFolderName('');
  };

  const startRename = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

  const submitRename = async () => {
    if (!editingId || !editingName.trim()) {
      setEditingId(null);
      return;
    }
    try {
      await renameFolder(editingId, editingName.trim());
      await loadFolders();
    } catch (err) {
      console.error('Failed to rename folder', err);
    }
    setEditingId(null);
    setEditingName('');
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteFolder(id);
      if (currentFolderId === id) {
        onFolderSelect(undefined);
      }
      await loadFolders();
    } catch (err) {
      console.error('Failed to delete folder', err);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, folderId: string, folderName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, folderId, folderName });
  };

  const renderNewFolderInput = (level: number) => {
    return (
      <div className="flex items-center gap-1 px-3 py-1" style={{ paddingLeft: `${(level * 12) + 12}px` }}>
        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        <input
          autoFocus
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onBlur={submitCreate}
          onKeyDown={(e) => { if (e.key === 'Enter') submitCreate(); if (e.key === 'Escape') { setCreatingParentId(undefined); setNewFolderName(''); } }}
          className="flex-1 text-sm bg-transparent border border-blue-400 rounded px-1 py-0.5 outline-none dark:text-white"
        />
      </div>
    );
  };

  const renderFolder = (node: FolderNode, level: number = 0) => {
    const isExpanded = expandedIds.has(node.id);
    const isSelected = currentFolderId === node.id;
    const hasChildren = node.children && node.children.length > 0;
    const isEditing = editingId === node.id;

    return (
      <div key={node.id} className="select-none">
        <div
          onClick={() => !isEditing && onFolderSelect(node.id)}
          onContextMenu={(e) => handleContextMenu(e, node.id, node.name)}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm transition-colors cursor-pointer group ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium' : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'}`}
          style={{ paddingLeft: `${(level * 12) + 12}px` }}
        >
          <div
            onClick={(e) => hasChildren && toggleExpand(node.id, e)}
            className={`w-4 h-4 flex items-center justify-center rounded hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors ${!hasChildren ? 'invisible' : ''}`}
          >
            <svg
              className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <svg className={`w-4 h-4 ${isSelected ? 'text-blue-500' : 'text-stone-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          {isEditing ? (
            <input
              autoFocus
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={submitRename}
              onKeyDown={(e) => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setEditingId(null); }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 text-sm bg-transparent border border-blue-400 rounded px-1 py-0.5 outline-none dark:text-white"
            />
          ) : (
            <span className="truncate flex-1">{node.name}</span>
          )}
          {!isEditing && node.imageCount > 0 && (
            <span className="text-[10px] text-stone-400 group-hover:text-stone-500">{node.imageCount}</span>
          )}
        </div>
        {isExpanded && hasChildren && (
          <div className="mt-0.5">
            {node.children.map(child => renderFolder(child, level + 1))}
          </div>
        )}
        {/* New folder input inside this folder */}
        {isExpanded && creatingParentId === node.id && renderNewFolderInput(level + 1)}
      </div>
    );
  };

  const contextMenuItems: MenuItem[] = contextMenu ? [
    { label: 'New Subfolder', onClick: () => handleCreateFolder(contextMenu.folderId) },
    { label: 'Rename', onClick: () => startRename(contextMenu.folderId, contextMenu.folderName) },
    { label: '', onClick: () => {}, divider: true },
    { label: 'Delete', onClick: () => handleDelete(contextMenu.folderId), danger: true },
  ] : [];

  return (
    <div className="space-y-0.5 px-1">
      {folders.length === 0 && creatingParentId === undefined ? (
        <div className="px-3 py-4 text-xs text-stone-400 italic">No folders yet</div>
      ) : (
        folders.map(folder => renderFolder(folder))
      )}
      {/* Root-level new folder input */}
      {creatingParentId === null && renderNewFolderInput(0)}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};

export { FolderTree };
export default FolderTree;
