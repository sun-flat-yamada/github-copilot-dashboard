import React from 'react';

interface EstimatedMarkerProps {
  /** Tooltip text; defaults to the per-metric explanation. */
  title?: string;
  /** Rendered inside running text (legend) instead of next to a value. */
  inline?: boolean;
}

/**
 * 「推測値」marker shown next to a raw metric whose value has no verified source (estimated, 要検証).
 */
export const EstimatedMarker: React.FC<EstimatedMarkerProps> = ({
  title = '出典で確認できなかったため、旧指標での順位を新指標の分布へ写像して推定した推測値です (要検証)',
  inline = false,
}) => (
  <span
    className={`text-[9px] font-bold font-sans px-1 py-px rounded border bg-orange-950/80 text-orange-300 border-orange-700/60 whitespace-nowrap ${
      inline ? 'inline-block align-middle mx-0.5' : ''
    }`}
    title={title}
    data-testid="estimated-marker"
  >
    推測値
  </span>
);

export default EstimatedMarker;
