import { FALLBACK_TICKET_LAYOUT } from '../constants';
import type { PriceDraft, PriceTemplate, TicketLayout, TicketLayoutPiece } from '../types';

export function updateTicketLayoutValue(
  layout: TicketLayout,
  part: keyof TicketLayout,
  key: keyof TicketLayoutPiece,
  value: string,
) : TicketLayout {
  return {
    ...layout,
    [part]: {
      ...layout[part],
      [key]: key === 'align' ? value : Number(value || 0),
    },
  };
}

export function priceDraftsFromTemplate(prices: PriceTemplate[]): PriceDraft[] {
  return prices.map((price) => ({
    label: price.label,
    amount: String(price.amount_cents),
  }));
}

export function priceTemplateFromDrafts(prices: PriceDraft[]): Array<{ label: string; amount: number; sort_order: number }> {
  return prices
    .filter((item) => item.label.trim())
    .map((item, index) => ({
      label: item.label.trim(),
      amount: Number(item.amount || 0),
      sort_order: index,
    }));
}

export function cloneTicketLayout(layout: TicketLayout): TicketLayout {
  return {
    price: { ...layout.price },
    row: { ...layout.row },
    seat: { ...layout.seat },
  };
}

export function ticketLayoutToJson(layout: TicketLayout): string {
  return JSON.stringify({
    price: {
      x: Number(layout.price.x || 0),
      y: Number(layout.price.y || 0),
      size: Number(layout.price.size || 0),
      align: layout.price.align || 'left',
    },
    row: {
      x: Number(layout.row.x || 0),
      y: Number(layout.row.y || 0),
      size: Number(layout.row.size || 0),
      align: layout.row.align || 'left',
    },
    seat: {
      x: Number(layout.seat.x || 0),
      y: Number(layout.seat.y || 0),
      size: Number(layout.seat.size || 0),
      align: layout.seat.align || 'left',
    },
  });
}

export function layoutFromApi(layout: TicketLayout | undefined | null): TicketLayout {
  return {
    price: {
      x: Number(layout?.price?.x ?? FALLBACK_TICKET_LAYOUT.price.x),
      y: Number(layout?.price?.y ?? FALLBACK_TICKET_LAYOUT.price.y),
      size: Number(layout?.price?.size ?? FALLBACK_TICKET_LAYOUT.price.size),
      align: layout?.price?.align ?? FALLBACK_TICKET_LAYOUT.price.align,
    },
    row: {
      x: Number(layout?.row?.x ?? FALLBACK_TICKET_LAYOUT.row.x),
      y: Number(layout?.row?.y ?? FALLBACK_TICKET_LAYOUT.row.y),
      size: Number(layout?.row?.size ?? FALLBACK_TICKET_LAYOUT.row.size),
      align: layout?.row?.align ?? FALLBACK_TICKET_LAYOUT.row.align,
    },
    seat: {
      x: Number(layout?.seat?.x ?? FALLBACK_TICKET_LAYOUT.seat.x),
      y: Number(layout?.seat?.y ?? FALLBACK_TICKET_LAYOUT.seat.y),
      size: Number(layout?.seat?.size ?? FALLBACK_TICKET_LAYOUT.seat.size),
      align: layout?.seat?.align ?? FALLBACK_TICKET_LAYOUT.seat.align,
    },
  };
}
