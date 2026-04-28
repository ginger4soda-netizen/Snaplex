import React, { useState, useCallback } from 'react';
import { ColorInfo } from '../../types';

type ColorFormat = 'hex' | 'rgb' | 'hsl';

interface ColorPaletteProps {
  colors: ColorInfo[] | null;
  colorCount: number;
  onColorCountChange: (count: number) => void;
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

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

const ColorPalette: React.FC<ColorPaletteProps> = ({ colors, colorCount, onColorCountChange }) => {
  const [format, setFormat] = useState<ColorFormat>('hex');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const handleCopy = useCallback(async (color: ColorInfo, index: number) => {
    await copyToClipboard(formatColor(color, format));
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  }, [format]);

  const handleCopyAll = useCallback(async () => {
    if (!colors || colors.length === 0) return;
    const lines = colors.map(c =>
      `${formatColor(c, format)}  ${c.percentage.toFixed(1)}%  ${c.name}`
    );
    await copyToClipboard(lines.join('\n'));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1500);
  }, [colors, format]);

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
      {/* Controls row: format toggle (left) | slider + copy (right) */}
      <div className="flex items-center justify-between">
        {/* Left: format toggle */}
        <button
          onClick={cycleFormat}
          className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 hover:text-stone-700 dark:hover:text-stone-200 transition-colors uppercase tracking-wider"
        >
          {format}
        </button>

        {/* Right: color count slider + copy all */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-stone-400 font-mono tabular-nums">{colorCount}</span>
          <input
            type="range"
            min={8}
            max={16}
            value={colorCount}
            onChange={(e) => onColorCountChange(Number(e.target.value))}
            className="w-16 h-1 accent-stone-400 cursor-pointer"
          />
          <button
            onClick={handleCopyAll}
            className="p-1 rounded-md text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            title="Copy all colors"
          >
            {copiedAll ? (
              <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        </div>
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
    </div>
  );
};

export default ColorPalette;
