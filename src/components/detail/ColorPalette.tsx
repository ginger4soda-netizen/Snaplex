import React, { useState, useCallback } from 'react';
import { ColorInfo } from '../../types';

type ColorFormat = 'hex' | 'rgb' | 'hsl';

interface ColorPaletteProps {
  colors: ColorInfo[] | null;
}

const FORMAT_CYCLE: ColorFormat[] = ['hex', 'rgb', 'hsl'];

function formatColor(color: ColorInfo, format: ColorFormat): string {
  switch (format) {
    case 'hex':
      return color.hex;
    case 'rgb':
      return `rgb(${color.rgb[0]}, ${color.rgb[1]}, ${color.rgb[2]})`;
    case 'hsl':
      return `hsl(${color.hsl[0]}, ${color.hsl[1]}%, ${color.hsl[2]}%)`;
  }
}

const ColorPalette: React.FC<ColorPaletteProps> = ({ colors }) => {
  const [format, setFormat] = useState<ColorFormat>('hex');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const handleCopy = useCallback(async (color: ColorInfo, index: number) => {
    const text = formatColor(color, format);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    }
  }, [format]);

  const cycleFormat = useCallback(() => {
    setFormat(prev => {
      const idx = FORMAT_CYCLE.indexOf(prev);
      return FORMAT_CYCLE[(idx + 1) % FORMAT_CYCLE.length];
    });
  }, []);

  // Loading skeleton
  if (!colors || colors.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex gap-0.5 rounded-xl overflow-hidden h-8 animate-pulse">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex-1 bg-stone-200 dark:bg-stone-700" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {/* Format toggle */}
      <div className="flex justify-end">
        <button
          onClick={cycleFormat}
          className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 hover:text-stone-700 dark:hover:text-stone-200 transition-colors uppercase tracking-wider"
        >
          {format}
        </button>
      </div>

      {/* Color Bar - proportional widths based on percentage */}
      <div className="flex rounded-xl overflow-hidden h-9 shadow-sm border border-stone-100 dark:border-stone-800">
        {colors.map((color, i) => (
          <button
            key={i}
            onClick={() => handleCopy(color, i)}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
            className="relative transition-all duration-200"
            style={{
              backgroundColor: color.hex,
              flex: Math.max(color.percentage, 4), // Minimum visual width
            }}
            title={`${color.name} — ${formatColor(color, format)} (${color.percentage.toFixed(1)}%)`}
          >
            {/* Hover ring */}
            {hoveredIndex === i && (
              <div className="absolute inset-0 ring-2 ring-white/80 ring-inset z-10 rounded-sm" />
            )}
            {/* Copied checkmark */}
            {copiedIndex === i && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-20">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Hovered color detail */}
      {hoveredIndex !== null && colors[hoveredIndex] && (
        <div className="flex items-center gap-2 px-0.5 text-xs text-stone-500 dark:text-stone-400">
          <div
            className="w-3 h-3 rounded-full border border-stone-200 dark:border-stone-700 shrink-0"
            style={{ backgroundColor: colors[hoveredIndex].hex }}
          />
          <span className="font-medium text-stone-600 dark:text-stone-300">{colors[hoveredIndex].name}</span>
          <span className="font-mono text-[11px]">{formatColor(colors[hoveredIndex], format)}</span>
          <span className="text-stone-400">{colors[hoveredIndex].percentage.toFixed(1)}%</span>
        </div>
      )}

      {/* Expanded color grid */}
      <div className="grid grid-cols-4 gap-1">
        {colors.map((color, i) => (
          <button
            key={i}
            onClick={() => handleCopy(color, i)}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors text-left group"
          >
            <div
              className="w-4 h-4 rounded shrink-0 border border-stone-200/50 dark:border-stone-700/50 shadow-sm group-hover:scale-110 transition-transform"
              style={{ backgroundColor: color.hex }}
            />
            <span className="text-[10px] font-mono text-stone-500 dark:text-stone-400 truncate leading-tight">
              {copiedIndex === i ? (
                <span className="text-green-500">Copied!</span>
              ) : (
                formatColor(color, format)
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ColorPalette;
