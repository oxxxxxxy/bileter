export type HallCell = { label: string };

export type HallRow = {
  label: string;
  seats: HallCell[];
};

export type SeatRow = {
  label: string;
  seats: SeatItem[];
};

export type HallPreviewSeat = {
  label: string;
  active: boolean;
  displayLabel: string;
};

export type HallPreviewRow = {
  label: string;
  seats: HallPreviewSeat[];
};

export type PriceOption = {
  id: number;
  label: string;
  amount_cents: number;
};

export type TicketLayoutPiece = {
  x: number;
  y: number;
  size: number;
  align: 'left' | 'center' | 'right';
};

export type TicketLayout = {
  price: TicketLayoutPiece;
  row: TicketLayoutPiece;
  seat: TicketLayoutPiece;
};

export type PriceTemplate = {
  label: string;
  amount_cents: number;
  sort_order: number;
};

export type SelectedTicket = {
  row_label: string;
  seat_label: string;
  price_option_id: number;
};

export type EventItem = {
  id: number;
  title: string;
  template_path?: string | null;
  ticket_layout?: TicketLayout;
  active: boolean;
  created_at: string;
  prices: PriceOption[];
  sold_count: number;
  seat_counts: {
    free: number;
    reserved: number;
    sold: number;
    inactive?: number;
  };
};

export type SeatItem = {
  id: number;
  row_label: string;
  seat_label: string;
  status: 'free' | 'reserved' | 'sold';
  active: boolean;
  sale_id: number | null;
  updated_at: string;
  display_label?: string;
};

export type Stats = {
  total_seats: number;
  active_seats: number;
  sold_count: number;
  reserved_count: number;
  free_count: number;
  inactive_count: number;
  fill_percent: number;
  sold_percent: number;
  revenue_cents: number;
  price_breakdown: Array<{
    price_id: number;
    label: string;
    amount_cents: number;
    sold_count: number;
    revenue_cents: number;
  }>;
};

export type EventDraft = {
  title: string;
};

export type PriceDraft = {
  label: string;
  amount: string;
};

export type SaleChoice = {
  price_option_id: string;
};

export type SaleMode = 'sell' | 'cancel' | 'reserve';

export type ReportPrintMode = 'combined' | 'separate';

export type Page = 'list' | 'create' | 'edit' | 'sale' | 'settings' | 'report-settings';

export type ReportSettings = {
  font_size: number;
};

export type PrintersData = {
  printers: string[];
  active: string | null;
};

export type HallSettingsData = {
  rows_count: number;
  seats_count: number;
  inactive_seats: Array<{
    row_label: string;
    seat_label: string;
  }>;
  default_prices: PriceTemplate[];
  default_ticket_template_path?: string | null;
  default_ticket_layout: TicketLayout;
  default_report_settings: ReportSettings;
  updated_at?: string | null;
};
