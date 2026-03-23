import React from 'react';
import FolderTree from '../folders/FolderTree';

interface SidebarProps {
  currentFolderId?: string;
  onFolderSelect: (folderId: string | undefined) => void;
  onNavigate?: (mode: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentFolderId, onFolderSelect, onNavigate }) => {
  return (
    <div className="flex flex-col h-full bg-stone-50/50 dark:bg-stone-900/50 backdrop-blur-md">
      {/* App Header / Logo */}
      <div className="p-4 flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">S</div>
        <h1 className="font-bold text-lg tracking-tight dark:text-white">Snaplex</h1>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
        {/* Library Section */}
        <div>
          <h2 className="px-3 mb-1 text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">Library</h2>
          <div className="space-y-0.5">
            <button 
              onClick={() => onFolderSelect(undefined)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${!currentFolderId ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium' : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'}`}
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
          <h2 className="px-3 mb-1 text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">Folders</h2>
          <FolderTree 
            currentFolderId={currentFolderId}
            onFolderSelect={onFolderSelect}
          />
        </div>

        {/* Tools Section */}
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

      {/* Sidebar Footer */}
      <div className="p-2 border-t border-stone-200 dark:border-stone-800">
        <button
          onClick={() => onNavigate?.('settings')}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 002.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
