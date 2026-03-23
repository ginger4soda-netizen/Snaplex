import React, { useState, useCallback, useRef, useEffect } from 'react';
import Sidebar from './Sidebar';
import ImageGrid from './ImageGrid';
import DetailPanel from '../detail/DetailPanel';
import Settings from '../Settings';
import StylePrinter from '../StylePrinter';
import About from '../About';
import { UserSettings } from '@/types';

interface ThreeColumnLayoutProps {
  centerView: 'grid' | 'settings' | 'stylePrinter' | 'about';
  currentFolderId?: string;
  onFolderSelect: (folderId: string | undefined) => void;
  selectedImageId?: string;
  onImageSelect: (imageId: string | undefined) => void;
  onNavigate?: (mode: string) => void;
  settings: UserSettings;
  onSaveSettings: (settings: UserSettings) => void;
  nav: { goBack: () => void; goForward: () => void; canGoBack: boolean; canGoForward: boolean };
}

const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 400;
const DETAIL_MIN = 280;
const DETAIL_MAX = 600;

const ThreeColumnLayout: React.FC<ThreeColumnLayoutProps> = ({
  centerView,
  currentFolderId,
  onFolderSelect,
  selectedImageId,
  onImageSelect,
  onNavigate,
  settings,
  onSaveSettings,
  nav,
}) => {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('snaplex-sidebar-width');
    return saved ? Number(saved) : 240;
  });
  const [detailWidth, setDetailWidth] = useState(() => {
    const saved = localStorage.getItem('snaplex-detail-width');
    return saved ? Number(saved) : 380;
  });
  const [isDetailVisible, setIsDetailVisible] = useState(true);
  const [dragging, setDragging] = useState<'sidebar' | 'detail' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Persist widths
  useEffect(() => { localStorage.setItem('snaplex-sidebar-width', String(sidebarWidth)); }, [sidebarWidth]);
  useEffect(() => { localStorage.setItem('snaplex-detail-width', String(detailWidth)); }, [detailWidth]);

  const handleMouseDown = useCallback((panel: 'sidebar' | 'detail') => {
    setDragging(panel);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    if (dragging === 'sidebar') {
      const newWidth = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, e.clientX - rect.left));
      setSidebarWidth(newWidth);
    } else if (dragging === 'detail') {
      const newWidth = Math.min(DETAIL_MAX, Math.max(DETAIL_MIN, rect.right - e.clientX));
      setDetailWidth(newWidth);
    }
  }, [dragging]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  useEffect(() => {
    if (dragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  return (
    <div ref={containerRef} className="flex h-screen w-full overflow-hidden bg-cream dark:bg-stone-900 text-dark dark:text-stone-200 transition-colors duration-200">
      {/* Left Sidebar */}
      <div
        style={{ width: sidebarWidth }}
        className="h-full flex-shrink-0 border-r border-stone-200 dark:border-stone-800"
      >
        <Sidebar
          currentFolderId={currentFolderId}
          onFolderSelect={onFolderSelect}
          onNavigate={onNavigate}
        />
      </div>

      {/* Sidebar Resize Handle */}
      <div
        onMouseDown={() => handleMouseDown('sidebar')}
        className={`w-1 h-full flex-shrink-0 cursor-col-resize hover:bg-blue-400/40 active:bg-blue-500/60 transition-colors ${dragging === 'sidebar' ? 'bg-blue-500/60' : 'bg-transparent'}`}
      />

      {/* Middle Column */}
      <div className="flex-1 h-full flex flex-col min-w-[300px]">
        {centerView === 'grid' ? (
          <ImageGrid
            folderId={currentFolderId}
            selectedImageId={selectedImageId}
            onImageSelect={onImageSelect}
            onToggleDetail={() => setIsDetailVisible(!isDetailVisible)}
            isDetailVisible={isDetailVisible}
            nav={nav}
          />
        ) : centerView === 'settings' ? (
          <div className="h-full overflow-y-auto">
            <Settings settings={settings} onSave={onSaveSettings} />
          </div>
        ) : centerView === 'stylePrinter' ? (
          <div className="h-full overflow-y-auto">
            <StylePrinter mode="standalone" systemLanguage={settings.systemLanguage} />
          </div>
        ) : centerView === 'about' ? (
          <div className="h-full overflow-y-auto">
            <About />
          </div>
        ) : null}
      </div>

      {/* Right Detail Panel */}
      {isDetailVisible && (
        <>
          {/* Detail Resize Handle */}
          <div
            onMouseDown={() => handleMouseDown('detail')}
            className={`w-1 h-full flex-shrink-0 cursor-col-resize hover:bg-blue-400/40 active:bg-blue-500/60 transition-colors ${dragging === 'detail' ? 'bg-blue-500/60' : 'bg-transparent'}`}
          />
          <div
            style={{ width: detailWidth }}
            className="h-full flex-shrink-0 border-l border-stone-200 dark:border-stone-800"
          >
            <DetailPanel
              imageId={selectedImageId}
              onClose={() => setIsDetailVisible(false)}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default ThreeColumnLayout;
