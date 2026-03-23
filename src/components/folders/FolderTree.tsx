import React, { useEffect, useState } from 'react';
import { useTauriIPC } from '@/hooks/useTauriIPC';
import { FolderNode } from '@/types';

interface FolderTreeProps {
  currentFolderId?: string;
  onFolderSelect: (folderId: string | undefined) => void;
}

const FolderTree: React.FC<FolderTreeProps> = ({ currentFolderId, onFolderSelect }) => {
  const { getFolderTree } = useTauriIPC();
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadFolders = async () => {
      try {
        const tree = await getFolderTree();
        setFolders(tree);
      } catch (err) {
        console.error("Failed to load folder tree", err);
      }
    };
    loadFolders();
  }, []);

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

  const renderFolder = (node: FolderNode, level: number = 0) => {
    const isExpanded = expandedIds.has(node.id);
    const isSelected = currentFolderId === node.id;
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.id} className="select-none">
        <div 
          onClick={() => onFolderSelect(node.id)}
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
          <span className="truncate flex-1">{node.name}</span>
          {node.imageCount > 0 && (
            <span className="text-[10px] text-stone-400 group-hover:text-stone-500">{node.imageCount}</span>
          )}
        </div>
        {isExpanded && hasChildren && (
          <div className="mt-0.5">
            {node.children.map(child => renderFolder(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-0.5 px-1">
      {folders.length === 0 ? (
        <div className="px-3 py-4 text-xs text-stone-400 italic">No folders yet</div>
      ) : (
        folders.map(folder => renderFolder(folder))
      )}
    </div>
  );
};

export default FolderTree;
