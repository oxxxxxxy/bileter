import { describe, expect, it } from 'vitest';

import { FALLBACK_TICKET_LAYOUT } from '../constants';
import { cloneTicketLayout, layoutFromApi, priceDraftsFromTemplate, priceTemplateFromDrafts, ticketLayoutToJson, updateTicketLayoutValue } from './ticketLayout';

describe('ticket layout utils', () => {
  it('updates numeric and align values immutably', () => {
    const updatedX = updateTicketLayoutValue(FALLBACK_TICKET_LAYOUT, 'price', 'x', '777');
    expect(updatedX.price.x).toBe(777);
    expect(FALLBACK_TICKET_LAYOUT.price.x).toBe(515);

    const updatedAlign = updateTicketLayoutValue(updatedX, 'seat', 'align', 'center');
    expect(updatedAlign.seat.align).toBe('center');
  });

  it('converts price drafts to templates and back', () => {
    const templates = priceTemplateFromDrafts([
      { label: ' Полная ', amount: '200' },
      { label: '', amount: '100' },
      { label: 'Льготная', amount: '100' },
    ]);
    expect(templates).toEqual([
      { label: 'Полная', amount: 200, sort_order: 0 },
      { label: 'Льготная', amount: 100, sort_order: 1 },
    ]);

    expect(priceDraftsFromTemplate([
      { label: 'Полная', amount_cents: 200, sort_order: 0 },
    ])).toEqual([{ label: 'Полная', amount: '200' }]);
  });

  it('clones layouts and normalizes api layout values', () => {
    const cloned = cloneTicketLayout(FALLBACK_TICKET_LAYOUT);
    expect(cloned).not.toBe(FALLBACK_TICKET_LAYOUT);
    expect(cloned.price).not.toBe(FALLBACK_TICKET_LAYOUT.price);

    const normalized = layoutFromApi({
      price: { x: 1, y: 2, size: 3, align: 'right' },
      row: { x: 4, y: 5, size: 6, align: 'center' },
      seat: { x: 7, y: 8, size: 9, align: 'left' },
    });
    expect(normalized.row.align).toBe('center');
    expect(JSON.parse(ticketLayoutToJson(normalized)).seat.size).toBe(9);
  });
});
