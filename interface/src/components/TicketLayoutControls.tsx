import { useEffect, useRef } from 'react';

import {
  TICKET_PREVIEW_HEIGHT,
  TICKET_PREVIEW_WIDTH,
  TICKET_RENDER_HEIGHT,
  TICKET_RENDER_WIDTH,
} from '../constants';
import type { TicketLayout, TicketLayoutPiece } from '../types';
import { updateTicketLayoutValue } from '../utils/ticketLayout';

function svgAnchor(align: TicketLayoutPiece['align']) {
  if (align === 'center') return 'middle';
  if (align === 'right') return 'end';
  return 'start';
}

function canvasAlign(align: TicketLayoutPiece['align']): CanvasTextAlign {
  if (align === 'center') return 'center';
  if (align === 'right') return 'right';
  return 'left';
}

export function TicketLayoutPreview({
  imageUrl,
  layout,
  className = '',
}: {
  imageUrl: string;
  layout: TicketLayout;
  className?: string;
}) {
  return (
    <div className={`ticket-layout-preview ${className}`.trim()}>
      {imageUrl ? <img src={imageUrl} alt="layout preview" className="ticket-layout-preview-image" /> : <div className="ticket-layout-preview-empty">Нет картинки билета</div>}
      <svg className="ticket-layout-preview-overlay" viewBox={`0 0 ${TICKET_PREVIEW_WIDTH} ${TICKET_PREVIEW_HEIGHT}`} preserveAspectRatio="none">
        <text x={layout.price.x} y={layout.price.y} fontSize={layout.price.size} fill="#6f1b21" fontFamily="Inter, sans-serif" textAnchor={svgAnchor(layout.price.align)}>
          12345 ₽
        </text>
        <text x={layout.row.x} y={layout.row.y} fontSize={layout.row.size} fill="#6f1b21" fontFamily="Inter, sans-serif" textAnchor={svgAnchor(layout.row.align)}>
          12
        </text>
        <text x={layout.seat.x} y={layout.seat.y} fontSize={layout.seat.size} fill="#6f1b21" fontFamily="Inter, sans-serif" textAnchor={svgAnchor(layout.seat.align)}>
          12
        </text>
      </svg>
    </div>
  );
}

export function TicketRenderedPreview({
  imageUrl,
  layout,
}: {
  imageUrl: string;
  layout: TicketLayout;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageUrl) {
      return;
    }

    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled || !canvas) return;
      canvas.width = TICKET_RENDER_WIDTH;
      canvas.height = TICKET_RENDER_HEIGHT;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#6f1b21';
      ctx.textBaseline = 'top';
      ctx.font = `${layout.price.size}px Inter, sans-serif`;
      ctx.textAlign = canvasAlign(layout.price.align);
      ctx.fillText('12345 ₽', layout.price.x, layout.price.y);
      ctx.font = `${layout.row.size}px Inter, sans-serif`;
      ctx.textAlign = canvasAlign(layout.row.align);
      ctx.fillText('12', layout.row.x, layout.row.y);
      ctx.font = `${layout.seat.size}px Inter, sans-serif`;
      ctx.textAlign = canvasAlign(layout.seat.align);
      ctx.fillText('12', layout.seat.x, layout.seat.y);
    };
    image.src = imageUrl;

    return () => {
      cancelled = true;
    };
  }, [imageUrl, layout]);

  return imageUrl ? <canvas ref={canvasRef} className="preview-image ticket-rendered-preview" /> : <div className="placeholder">Нет картинки билета</div>;
}

export function TicketLayoutInputs({
  layout,
  onChange,
  scope,
}: {
  layout: TicketLayout;
  onChange: (layout: TicketLayout) => void;
  scope: string;
}) {
  return (
    <div className="layout-editor">
      {(
        [
          ['price', 'Цена'],
          ['row', 'Ряд'],
          ['seat', 'Место'],
        ] as const
      ).map(([part, label]) => (
        <div className="layout-block" key={`${scope}-${part}`}>
          <div className="layout-label">{label}</div>
          <div className="layout-input-row">
            <label className="field">
              <span>X</span>
              <input
                type="number"
                min="0"
                value={layout[part].x}
                onChange={(e) => onChange(updateTicketLayoutValue(layout, part, 'x', e.target.value))}
              />
            </label>
            <label className="field">
              <span>Y</span>
              <input
                type="number"
                min="0"
                value={layout[part].y}
                onChange={(e) => onChange(updateTicketLayoutValue(layout, part, 'y', e.target.value))}
              />
            </label>
            <label className="field">
              <span>Размер</span>
              <input
                type="number"
                min="1"
                value={layout[part].size}
                onChange={(e) => onChange(updateTicketLayoutValue(layout, part, 'size', e.target.value))}
              />
            </label>
            <label className="field">
              <span>Выравнивание</span>
              <select
                value={layout[part].align}
                onChange={(e) => onChange(updateTicketLayoutValue(layout, part, 'align', e.target.value))}
              >
                <option value="left">Слева</option>
                <option value="center">По центру</option>
                <option value="right">Справа</option>
              </select>
            </label>
          </div>
        </div>
      ))}
    </div>
  );
}
