import React, { useRef, useState } from 'react';
import { ImageItem } from '@/types';
import { convertFileSrc } from '@tauri-apps/api/core';
import ContextMenu, { MenuItem } from '@/components/common/ContextMenu';

interface ImageCardProps {
  image: ImageItem;
  isSelected: boolean;
  onClick: (e?: React.MouseEvent) => void;
  onToggleFavorite?: (id: string) => void;
  onDelete?: (id: string) => void;
  onOpenInFinder?: (id: string) => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragMouseDown?: (e: React.MouseEvent) => void;
  onMoveToFolder?: (id: string) => void;
  onRemoveFromFolder?: (id: string) => void;
  onAnalyzePrompt?: (id: string) => void;
  canRemoveFromFolder?: boolean;
}

const ImageCard: React.FC<ImageCardProps> = ({ image, isSelected, onClick, onToggleFavorite, onDelete, onOpenInFinder, onDragStart, onDragEnd, onDragMouseDown, onMoveToFolder, onRemoveFromFolder, onAnalyzePrompt, canRemoveFromFolder = false }) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  // Tracks the last contextmenu timestamp on this card. macOS Ctrl+click fires
  // both contextmenu and a synthetic click with ctrlKey=true; we use this to
  // swallow any click that arrives in close succession after a right-click so
  // the multi-selection isn't accidentally toggled off.
  const lastContextRef = useRef(0);

  // Always convert file paths to Tauri asset:// URLs
  const thumbUrl = (() => {
    const url = image.thumbUrl;
    if (!url) return '';
    const filePath = url.startsWith('file://') ? url.slice(7) : url;
    return convertFileSrc(filePath);
  })();

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    lastContextRef.current = Date.now();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleClickGuarded = (e: React.MouseEvent) => {
    if (Date.now() - lastContextRef.current < 500) {
      e.stopPropagation();
      return;
    }
    onClick(e);
  };

  const menuItems: MenuItem[] = [
    {
      label: image.isFavorite ? 'Remove from Favorites' : 'Add to Favorites',
      onClick: () => onToggleFavorite?.(image.id),
    },
    {
      label: 'Show in Finder',
      onClick: () => onOpenInFinder?.(image.id),
    },
    {
      label: 'Move to Folder...',
      onClick: () => onMoveToFolder?.(image.id),
    },
    ...(canRemoveFromFolder ? [{
      label: 'Remove from Folder',
      onClick: () => onRemoveFromFolder?.(image.id),
    }] : []),
    {
      label: 'Analyze Prompt',
      onClick: () => onAnalyzePrompt?.(image.id),
    },
    { label: '', onClick: () => {}, divider: true },
    {
      label: 'Delete',
      onClick: () => onDelete?.(image.id),
      danger: true,
    },
  ];

  return (
    <>
      <div
        data-image-card
        data-image-id={image.id}
        data-selected={isSelected ? 'true' : 'false'}
        draggable={false}
        onMouseDown={(e) => onDragMouseDown?.(e)}
        onClick={handleClickGuarded}
        onDragStart={(e) => onDragStart?.(e)}
        onDragEnd={(e) => onDragEnd?.(e)}
        onContextMenu={handleContextMenu}
        className={`relative group cursor-pointer rounded-xl overflow-hidden transition-all duration-200 ${isSelected ? 'ring-4 ring-blue-500 shadow-xl scale-[0.98]' : 'hover:shadow-lg'}`}
      >
        <div className="aspect-square bg-stone-100 dark:bg-stone-800 overflow-hidden">
          <img
            src={thumbUrl}
            alt={image.filename}
            draggable={false}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
          />
        </div>

        {/* Overlay info */}
        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <p className="text-white text-[10px] font-medium truncate">{image.filename}</p>
        </div>

        {/* Favorite badge */}
        {image.isFavorite && (
          <div className="absolute top-2 right-2 p-1.5 bg-white/90 dark:bg-stone-900/90 rounded-full shadow-sm">
            <svg className="w-3 h-3 text-coral" fill="currentColor" viewBox="0 0 24 24">
              <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
        )}

        {/* Selection indicator */}
        {isSelected && (
          <div className="absolute top-2 left-2 p-1 bg-blue-500 rounded-full shadow-lg">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}

        {/* Analysis badge */}
        {image.hasAnalysis && (
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/40 backdrop-blur-sm rounded text-[8px] font-bold text-white uppercase tracking-wider">
            AI
          </div>
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={menuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
};

export default ImageCard;
