import { RotateCcw } from 'lucide-react';
import { SegmentType } from '../types/framing';

export type LayerFilter = 'all' | Exclude<SegmentType, 'neutral'>;

interface TopBarProps {
  activeLayer: LayerFilter;
  onChangeLayer: (layer: LayerFilter) => void;
  onResetToSample: () => void;
}

const LAYER_ITEMS: Array<{ id: LayerFilter; label: string; dotClass?: string }> = [
  { id: 'all', label: '전체 레이어' },
  { id: 'emotion', label: '감정 트리거', dotClass: 'bg-rose-400' },
  { id: 'vague', label: '모호한 출처', dotClass: 'bg-amber-400' },
  { id: 'fact', label: '순수 팩트', dotClass: 'bg-sky-400' },
];

export function TopBar({
  activeLayer,
  onChangeLayer,
  onResetToSample,
}: TopBarProps) {
  return (
    <header className="h-14 border-b border-slate-800/90 bg-[#0B1120] px-4 lg:px-6 flex items-center justify-between gap-8 shrink-0">
      {/* Zone 1: Single-line Brand Wordmark */}
      <a
        href="#top"
        onClick={(e) => {
          e.preventDefault();
          onChangeLayer('all');
        }}
        className="text-base font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded"
      >
        Framing X-Ray
      </a>

      {/* Zone 2: Clean single-line layer filter links */}
      <nav
        aria-label="X-레이 태깅 레이어 필터"
        className="hidden md:flex items-center gap-6 text-xs font-medium"
      >
        {LAYER_ITEMS.map((item) => {
          const isActive = activeLayer === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeLayer(item.id)}
              className={`relative py-2 flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded ${
                isActive
                  ? 'text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {item.dotClass && (
                <span
                  aria-hidden="true"
                  className={`w-1.5 h-1.5 rounded-sm ${item.dotClass}`}
                />
              )}
              <span>{item.label}</span>
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 -bottom-[11px] h-[2px] bg-sky-400"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Single primary reset action */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onResetToSample}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          <span>기본 샘플 복원</span>
        </button>
      </div>
    </header>
  );
}
