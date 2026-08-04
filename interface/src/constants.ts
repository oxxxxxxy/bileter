import type { EventDraft, PriceDraft, TicketLayout } from './types';

export const EMPTY_EVENT_DRAFT: EventDraft = {
  title: '',
};

export const PRINTER_STORAGE_KEY = 'webexe.selected_printer';
export const PRINTER_DITHER_STORAGE_KEY = 'webexe.printer_dither_enabled';
export const PRINTER_GAP_STORAGE_KEY = 'webexe.printer_ticket_gap_mm';
export const REPORT_PRINT_MODE_STORAGE_KEY = 'webexe.report_print_mode';

export const HALL_PRESETS: Array<{ id: string; label: string; rows: number; seats: number }> = [
  { id: '20x20', label: '20 x 20', rows: 20, seats: 20 },
  { id: '18x16', label: '18 x 16', rows: 18, seats: 16 },
  { id: '12x12', label: '12 x 12', rows: 12, seats: 12 },
];

export const FALLBACK_DEFAULT_PRICES: PriceDraft[] = [
  { label: 'Полная', amount: '200' },
  { label: 'Льготная', amount: '100' },
  { label: 'Бесплатно', amount: '0' },
];

export const FALLBACK_TICKET_LAYOUT: TicketLayout = {
  price: { x: 515, y: 365, size: 40, align: 'left' },
  row: { x: 840, y: 365, size: 45, align: 'left' },
  seat: { x: 990, y: 365, size: 45, align: 'left' },
};

export const TICKET_PREVIEW_WIDTH = 3780;
export const TICKET_PREVIEW_HEIGHT = 1358;
export const TICKET_RENDER_WIDTH = 1269;
export const TICKET_RENDER_HEIGHT = 456;
