import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';

import {
  EMPTY_EVENT_DRAFT,
  FALLBACK_DEFAULT_PRICES,
  FALLBACK_TICKET_LAYOUT,
  PRINTER_DITHER_STORAGE_KEY,
  PRINTER_GAP_STORAGE_KEY,
  PRINTER_STORAGE_KEY,
  REPORT_PRINT_MODE_STORAGE_KEY,
} from './constants';
import { PermissionDialog } from './components/PermissionDialog';
import { PrinterDialog } from './components/PrinterDialog';
import { useFilePreview } from './hooks/useFilePreview';
import { CreateEventPage } from './pages/CreateEventPage';
import { EditEventPage } from './pages/EditEventPage';
import { EventsListPage } from './pages/EventsListPage';
import { ReportSettingsPage } from './pages/ReportSettingsPage';
import { SalePage } from './pages/SalePage';
import { TemplateSettingsPage } from './pages/TemplateSettingsPage';
import type {
  EventDraft,
  EventItem,
  HallRow,
  HallSettingsData,
  Page,
  PriceDraft,
  PrintersData,
  SaleChoice,
  SaleMode,
  SeatItem,
  SeatRow,
  SelectedTicket,
  TicketLayout,
} from './types';
import { buildDisplayHall, buildHallPreview, getHallPreviewColumnState, getHallPreviewRowState, getSeatColumnState, getSeatRowState } from './utils/hallLayout';
import {
  cloneTicketLayout,
  layoutFromApi,
  priceDraftsFromTemplate,
  priceTemplateFromDrafts,
  ticketLayoutToJson,
} from './utils/ticketLayout';

export default function App() {
  const [page, setPage] = useState<Page>('list');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [hall, setHall] = useState<HallRow[]>([]);
  const [seats, setSeats] = useState<SeatItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const [hallSettings, setHallSettings] = useState<HallSettingsData>({
    rows_count: 20,
    seats_count: 20,
    inactive_seats: [],
    default_prices: [],
    default_ticket_layout: FALLBACK_TICKET_LAYOUT,
    default_report_settings: { font_size: 28 },
  });
  const [printers, setPrinters] = useState<string[]>([]);
  const [printerActive, setPrinterActive] = useState<string | null>(null);
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [printerDitherEnabled, setPrinterDitherEnabled] = useState(true);
  const [printerTicketGapMm, setPrinterTicketGapMm] = useState(4);
  const [printerPickerOpen, setPrinterPickerOpen] = useState(false);

  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const activeEvent = useMemo(
    () => events.find((item) => item.id === selectedEventId) || null,
    [events, selectedEventId],
  );

  const [selectedRow, setSelectedRow] = useState('');
  const [selectedSeat, setSelectedSeat] = useState('');
  const [selectedTickets, setSelectedTickets] = useState<SelectedTicket[]>([]);
  const [ticketPreviewUrl, setTicketPreviewUrl] = useState('');
  const [saleMode, setSaleMode] = useState<SaleMode>('sell');
  const [cancelModeDialogOpen, setCancelModeDialogOpen] = useState(false);
  const [cancelModeConsent, setCancelModeConsent] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetConfirmConsent, setResetConfirmConsent] = useState(false);
  const [resetConfirmTitle, setResetConfirmTitle] = useState('');
  const [resetConfirmEventId, setResetConfirmEventId] = useState<number | null>(null);
  const [reportPrintMode, setReportPrintMode] = useState<'combined' | 'separate'>('separate');

  const [createDraft, setCreateDraft] = useState<EventDraft>(EMPTY_EVENT_DRAFT);
  const [settingsPrices, setSettingsPrices] = useState<PriceDraft[]>(FALLBACK_DEFAULT_PRICES);
  const [createPrices, setCreatePrices] = useState<PriceDraft[]>(FALLBACK_DEFAULT_PRICES);
  const [settingsTicketLayout, setSettingsTicketLayout] = useState<TicketLayout>(FALLBACK_TICKET_LAYOUT);
  const [createTicketLayout, setCreateTicketLayout] = useState<TicketLayout>(FALLBACK_TICKET_LAYOUT);
  const [createTemplate, setCreateTemplate] = useState<File | null>(null);
  const createTemplatePreviewUrl = useFilePreview(createTemplate);
  const [createHallRows, setCreateHallRows] = useState('20');
  const [createHallSeats, setCreateHallSeats] = useState('20');
  const [createInactiveSeats, setCreateInactiveSeats] = useState<string[]>([]);

  const [settingsRows, setSettingsRows] = useState('20');
  const [settingsSeats, setSettingsSeats] = useState('20');
  const [settingsInactiveSeats, setSettingsInactiveSeats] = useState<string[]>([]);
  const [settingsTemplateFile, setSettingsTemplateFile] = useState<File | null>(null);
  const settingsTemplatePreviewUrl = useFilePreview(settingsTemplateFile);
  const [settingsRenderedPreviewUrl, setSettingsRenderedPreviewUrl] = useState('');
  const [reportFontSize, setReportFontSize] = useState('28');
  const [reportPreviewUrl, setReportPreviewUrl] = useState('');

  const [editDraft, setEditDraft] = useState<EventDraft>(EMPTY_EVENT_DRAFT);
  const [editTemplate, setEditTemplate] = useState<File | null>(null);
  const editTemplatePreviewUrl = useFilePreview(editTemplate);
  const [editTicketLayout, setEditTicketLayout] = useState<TicketLayout>(FALLBACK_TICKET_LAYOUT);
  const [editRenderedPreviewUrl, setEditRenderedPreviewUrl] = useState('');

  const [saleChoice, setSaleChoice] = useState<SaleChoice>({
    price_option_id: '',
  });
  const displayHall = useMemo<SeatRow[]>(() => buildDisplayHall(seats), [seats]);

  const editorColumnLabels = useMemo(
    () => displayHall[0]?.seats.map((seat) => seat.seat_label) || [],
    [displayHall],
  );

  const createHallPreview = useMemo(
    () => buildHallPreview(createHallRows, createHallSeats, createInactiveSeats),
    [createHallRows, createHallSeats, createInactiveSeats],
  );

  const settingsHallPreview = useMemo(
    () => buildHallPreview(settingsRows, settingsSeats, settingsInactiveSeats),
    [settingsRows, settingsSeats, settingsInactiveSeats],
  );

  const settingsRowLabels = useMemo(
    () => Array.from({ length: Math.max(1, Number(settingsRows || 20)) }, (_, index) => String(index + 1)),
    [settingsRows],
  );

  const settingsColumnLabels = useMemo(
    () => Array.from({ length: Math.max(1, Number(settingsSeats || 20)) }, (_, index) => String(Math.max(1, Number(settingsSeats || 20)) - index)),
    [settingsSeats],
  );

  function toggleCreateSeat(rowLabel: string, seatLabel: string) {
    const key = `${rowLabel}-${seatLabel}`;
    setCreateInactiveSeats((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  function toggleSettingsSeat(rowLabel: string, seatLabel: string) {
    const key = `${rowLabel}-${seatLabel}`;
    setSettingsInactiveSeats((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  function getSettingsRowState(rowLabel: string): 'active' | 'inactive' | 'mixed' {
    return getHallPreviewRowState(settingsHallPreview, rowLabel);
  }

  function getSettingsColumnState(seatLabel: string): 'active' | 'inactive' | 'mixed' {
    return getHallPreviewColumnState(settingsHallPreview, seatLabel);
  }

  function toggleSettingsRow(rowLabel: string) {
    const rowState = getSettingsRowState(rowLabel);
    const rowSeats = settingsHallPreview.find((row) => row.label === rowLabel)?.seats || [];
    if (rowState === 'active') {
      setSettingsInactiveSeats((current) => {
        const next = new Set(current);
        for (const seat of rowSeats) {
          next.add(`${rowLabel}-${seat.label}`);
        }
        return Array.from(next);
      });
      return;
    }
    setSettingsInactiveSeats((current) => {
      const next = new Set(current);
      for (const seat of rowSeats) {
        next.delete(`${rowLabel}-${seat.label}`);
      }
      return Array.from(next);
    });
  }

  function toggleSettingsColumn(seatLabel: string) {
    const columnState = getSettingsColumnState(seatLabel);
    if (columnState === 'active') {
      setSettingsInactiveSeats((current) => {
        const next = new Set(current);
        for (const rowLabel of settingsRowLabels) {
          next.add(`${rowLabel}-${seatLabel}`);
        }
        return Array.from(next);
      });
      return;
    }
    setSettingsInactiveSeats((current) => {
      const next = new Set(current);
      for (const rowLabel of settingsRowLabels) {
        next.delete(`${rowLabel}-${seatLabel}`);
      }
      return Array.from(next);
    });
  }

  function applyHallPreset(rows: number, seats: number) {
    setCreateHallRows(String(rows));
    setCreateHallSeats(String(seats));
    setCreateInactiveSeats([]);
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(PRINTER_STORAGE_KEY);
    if (saved) {
      setSelectedPrinter(saved);
    }
    const savedDither = window.localStorage.getItem(PRINTER_DITHER_STORAGE_KEY);
    if (savedDither !== null) {
      setPrinterDitherEnabled(savedDither === 'true');
    }
    const savedGap = window.localStorage.getItem(PRINTER_GAP_STORAGE_KEY);
    if (savedGap !== null) {
      const parsed = Number(savedGap);
      if (!Number.isNaN(parsed)) {
        setPrinterTicketGapMm(parsed);
      }
    }
    const savedReportMode = window.localStorage.getItem(REPORT_PRINT_MODE_STORAGE_KEY);
    if (savedReportMode === 'combined' || savedReportMode === 'separate') {
      setReportPrintMode(savedReportMode);
    }
  }, []);

  useEffect(() => {
    if ((page === 'sale' || page === 'edit') && selectedEventId !== null) {
      void loadEventDetail(selectedEventId);
    }
  }, [page, selectedEventId]);

  useEffect(() => {
    if (page !== 'sale' || selectedEventId === null || saleMode !== 'sell') {
      setTicketPreviewUrl('');
      return;
    }
    const timer = window.setTimeout(() => {
      void refreshTicketPreview();
    }, 180);
    return () => window.clearTimeout(timer);
  }, [page, selectedEventId, saleMode, selectedTickets, printerTicketGapMm, reloadToken]);

  useEffect(() => {
    if (page !== 'edit' || selectedEventId === null || editTemplatePreviewUrl) {
      setEditRenderedPreviewUrl('');
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/tickets/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_id: selectedEventId,
            ticket_layout: editTicketLayout,
            price_text: '12345 ₽',
            row_text: '12',
            seat_text: '12',
          }),
        });
        if (!response.ok) throw new Error(await response.text());
        const data = (await response.json()) as { preview_png_base64: string };
        setEditRenderedPreviewUrl(`data:image/png;base64,${data.preview_png_base64}`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Не удалось загрузить превью билета');
      }
    }, 120);
    return () => window.clearTimeout(timer);
  }, [page, selectedEventId, editTicketLayout, editTemplatePreviewUrl, reloadToken]);

  useEffect(() => {
    if (page !== 'settings' || settingsTemplatePreviewUrl) {
      setSettingsRenderedPreviewUrl('');
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/hall-settings/ticket-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticket_layout: settingsTicketLayout,
            price_text: '12345 ₽',
            row_text: '12',
            seat_text: '12',
          }),
        });
        if (!response.ok) throw new Error(await response.text());
        const data = (await response.json()) as { preview_png_base64: string };
        setSettingsRenderedPreviewUrl(`data:image/png;base64,${data.preview_png_base64}`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Не удалось загрузить превью шаблона');
      }
    }, 120);
    return () => window.clearTimeout(timer);
  }, [page, settingsTicketLayout, settingsTemplatePreviewUrl, reloadToken]);

  useEffect(() => {
    if (page !== 'report-settings') {
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/report-settings/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            font_size: Number(reportFontSize || 28),
          }),
        });
        if (!response.ok) throw new Error(await response.text());
        const data = (await response.json()) as { preview_png_base64: string };
        setReportPreviewUrl(`data:image/png;base64,${data.preview_png_base64}`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Не удалось загрузить превью сводки');
      }
    }, 120);
    return () => window.clearTimeout(timer);
  }, [page, reportFontSize, reloadToken]);

  async function loadData() {
    setBusy(true);
    try {
      const [eventsResponse, hallResponse, settingsResponse, printersResponse] = await Promise.all([
        fetch('/api/events'),
        fetch('/api/hall-layout'),
        fetch('/api/hall-settings'),
        fetch('/api/printers'),
      ]);
      if (!eventsResponse.ok) throw new Error(await eventsResponse.text());
      if (!hallResponse.ok) throw new Error(await hallResponse.text());
      if (!settingsResponse.ok) throw new Error(await settingsResponse.text());
      if (!printersResponse.ok) throw new Error(await printersResponse.text());
      setEvents((await eventsResponse.json()) as EventItem[]);
      setHall((await hallResponse.json()) as HallRow[]);
      const hallSettingsData = (await settingsResponse.json()) as HallSettingsData;
      setHallSettings(hallSettingsData);
      const templatePrices = priceDraftsFromTemplate(hallSettingsData.default_prices || []);
      const nextTemplatePrices = templatePrices.length > 0 ? templatePrices : FALLBACK_DEFAULT_PRICES;
      const nextTicketLayout = layoutFromApi(hallSettingsData.default_ticket_layout || FALLBACK_TICKET_LAYOUT);
      setCreateHallRows(String(hallSettingsData.rows_count));
      setCreateHallSeats(String(hallSettingsData.seats_count));
      setCreateInactiveSeats(
        hallSettingsData.inactive_seats.map((item) => `${item.row_label}-${item.seat_label}`),
      );
      setSettingsPrices(nextTemplatePrices);
      setCreatePrices(nextTemplatePrices);
      setSettingsTicketLayout(nextTicketLayout);
      setCreateTicketLayout(nextTicketLayout);
      setSettingsRows(String(hallSettingsData.rows_count));
      setSettingsSeats(String(hallSettingsData.seats_count));
      setSettingsInactiveSeats(
        hallSettingsData.inactive_seats.map((item) => `${item.row_label}-${item.seat_label}`),
      );
      setReportFontSize(String(hallSettingsData.default_report_settings?.font_size || 28));
      const printersData = (await printersResponse.json()) as PrintersData;
      setPrinters(printersData.printers);
      setPrinterActive(printersData.active);
      setSelectedPrinter((current) => {
        const saved = window.localStorage.getItem(PRINTER_STORAGE_KEY) || '';
        if (saved && printersData.printers.includes(saved)) {
          return saved;
        }
        if (current && printersData.printers.includes(current)) {
          return current;
        }
        return printersData.active || printersData.printers[0] || '';
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Не удалось загрузить данные');
    } finally {
      setBusy(false);
    }
  }

  function getPrinterName(): string {
    return selectedPrinter || printerActive || printers[0] || '';
  }

  function choosePrinter(name: string) {
    setSelectedPrinter(name);
    if (name) {
      window.localStorage.setItem(PRINTER_STORAGE_KEY, name);
    } else {
      window.localStorage.removeItem(PRINTER_STORAGE_KEY);
    }
  }

  function choosePrinterDither(enabled: boolean) {
    setPrinterDitherEnabled(enabled);
    window.localStorage.setItem(PRINTER_DITHER_STORAGE_KEY, String(enabled));
  }

  function choosePrinterGap(mm: number) {
    setPrinterTicketGapMm(mm);
    window.localStorage.setItem(PRINTER_GAP_STORAGE_KEY, String(mm));
  }

  function chooseReportPrintMode(mode: 'combined' | 'separate') {
    setReportPrintMode(mode);
    window.localStorage.setItem(REPORT_PRINT_MODE_STORAGE_KEY, mode);
  }

  async function openPrinterSystemSettings() {
    setStatus('');
    try {
      const response = await fetch('/api/printers/open-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ printer_name: getPrinterName() }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setStatus('Окно настроек принтера открыто');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Не удалось открыть настройки принтера');
    }
  }

  async function loadEventDetail(eventId: number) {
    try {
      const seatsResponse = await fetch(`/api/events/${eventId}/seats`);
      if (!seatsResponse.ok) throw new Error(await seatsResponse.text());
      const seatsData = (await seatsResponse.json()) as SeatItem[];
      setSeats(seatsData);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Не удалось загрузить мероприятие');
    }
  }

  async function refreshTicketPreview() {
    if (selectedEventId === null) return;
    const previewTickets =
      selectedTickets.length > 0
        ? selectedTickets
        : [
            {
              row_label: '',
              seat_label: '',
              price_option_id: Number(saleChoice.price_option_id || activeEvent?.prices[0]?.id || 0),
            },
          ];
    const response = await fetch('/api/tickets/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: selectedEventId,
        tickets: previewTickets,
        ticket_gap_mm: printerTicketGapMm,
        preview_blank: selectedTickets.length === 0,
      }),
    });
    if (!response.ok) {
      setStatus(await response.text());
      return;
    }
    const data = (await response.json()) as { preview_png_base64: string };
    setTicketPreviewUrl(`data:image/png;base64,${data.preview_png_base64}`);
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus('');
    try {
      const formData = new FormData();
      formData.append('title', createDraft.title);
      formData.append('hall_rows', createHallRows || '20');
      formData.append('hall_seats', createHallSeats || '20');
      formData.append(
        'prices_json',
        JSON.stringify(priceTemplateFromDrafts(createPrices)),
      );
      formData.append('ticket_layout_json', ticketLayoutToJson(createTicketLayout));
      formData.append(
        'inactive_seats_json',
        JSON.stringify(
          createInactiveSeats.map((key) => {
            const [row_label, seat_label] = key.split('-');
            return { row_label, seat_label };
          }),
        ),
      );
      if (createTemplate) formData.append('template', createTemplate);

      const response = await fetch('/api/events', { method: 'POST', body: formData });
      if (!response.ok) throw new Error(await response.text());
      setCreateDraft(EMPTY_EVENT_DRAFT);
      setCreatePrices(settingsPrices.length > 0 ? settingsPrices : FALLBACK_DEFAULT_PRICES);
      setCreateTicketLayout(cloneTicketLayout(settingsTicketLayout));
      setCreateTemplate(null);
      setCreateHallRows('20');
      setCreateHallSeats('20');
      setCreateInactiveSeats([]);
      setStatus('Мероприятие создано');
      await loadData();
      setPage('list');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Не удалось создать мероприятие');
    } finally {
      setBusy(false);
    }
  }

  async function saveHallSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus('');
    try {
      const formData = new FormData();
      formData.append('rows_count', settingsRows || '20');
      formData.append('seats_count', settingsSeats || '20');
      formData.append(
        'inactive_seats_json',
        JSON.stringify(
          settingsInactiveSeats.map((key) => {
            const [row_label, seat_label] = key.split('-');
            return { row_label, seat_label };
          }),
        ),
      );
      formData.append('default_prices_json', JSON.stringify(priceTemplateFromDrafts(settingsPrices)));
      formData.append('default_ticket_layout_json', ticketLayoutToJson(settingsTicketLayout));
      formData.append('default_report_settings_json', JSON.stringify({ font_size: Number(reportFontSize || 28) }));
      const defaultTemplateInput = document.getElementById('settings-default-ticket-template') as HTMLInputElement | null;
      const defaultTemplate = defaultTemplateInput?.files?.[0] || null;
      if (defaultTemplate) {
        formData.append('default_template', defaultTemplate);
      }
      const response = await fetch('/api/hall-settings', {
        method: 'PUT',
        body: formData,
      });
      if (!response.ok) throw new Error(await response.text());
      const data = (await response.json()) as HallSettingsData;
      setHallSettings(data);
      const nextTemplatePrices = priceDraftsFromTemplate(data.default_prices || []);
      const normalizedTemplatePrices = nextTemplatePrices.length > 0 ? nextTemplatePrices : FALLBACK_DEFAULT_PRICES;
      setSettingsPrices(normalizedTemplatePrices);
      setCreatePrices(normalizedTemplatePrices);
      setSettingsTicketLayout(layoutFromApi(data.default_ticket_layout || FALLBACK_TICKET_LAYOUT));
      setCreateTicketLayout(layoutFromApi(data.default_ticket_layout || FALLBACK_TICKET_LAYOUT));
      setCreateHallRows(String(data.rows_count));
      setCreateHallSeats(String(data.seats_count));
      setCreateInactiveSeats(data.inactive_seats.map((item) => `${item.row_label}-${item.seat_label}`));
      setReportFontSize(String(data.default_report_settings?.font_size || 28));
      setStatus('Шаблон мероприятия сохранён');
      await loadData();
      setPage('settings');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Не удалось сохранить шаблон мероприятия');
    } finally {
      setBusy(false);
    }
  }

  async function saveReportSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus('');
    try {
      const formData = new FormData();
      formData.append('font_size', reportFontSize || '28');
      const response = await fetch('/api/report-settings', {
        method: 'PUT',
        body: formData,
      });
      if (!response.ok) throw new Error(await response.text());
      const data = (await response.json()) as HallSettingsData;
      setHallSettings(data);
      setReportFontSize(String(data.default_report_settings?.font_size || 28));
      setStatus('Настройки сводки сохранены');
      await loadData();
      setPage('report-settings');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Не удалось сохранить настройки сводки');
    } finally {
      setBusy(false);
    }
  }

  function openSalePage(eventId: number) {
    const event = events.find((item) => item.id === eventId) || null;
    if (!event) return;
    setSelectedEventId(eventId);
    setSaleChoice({ price_option_id: event.prices[0] ? String(event.prices[0].id) : '' });
    setSelectedRow('');
    setSelectedSeat('');
    setSelectedTickets([]);
    setSaleMode('sell');
    setCancelModeDialogOpen(false);
    setCancelModeConsent(false);
    setTicketPreviewUrl('');
    setPage('sale');
  }

  function openEditPage(eventId: number) {
    const event = events.find((item) => item.id === eventId) || null;
    if (!event) return;
    setSelectedEventId(eventId);
    setSelectedRow('');
    setSelectedSeat('');
    setEditDraft({
      title: event.title,
    });
    setEditTemplate(null);
    setEditTicketLayout(layoutFromApi(event.ticket_layout || FALLBACK_TICKET_LAYOUT));
    setSelectedTickets([]);
    setTicketPreviewUrl('');
    setSaleMode('sell');
    setCancelModeDialogOpen(false);
    setCancelModeConsent(false);
    setPage('edit');
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedEventId === null) return;
    setBusy(true);
    setStatus('');
    try {
      const formData = new FormData();
      formData.append('title', editDraft.title);
      formData.append('ticket_layout_json', ticketLayoutToJson(editTicketLayout));
      if (editTemplate) formData.append('template', editTemplate);
      const response = await fetch(`/api/events/${selectedEventId}`, {
        method: 'PUT',
        body: formData,
      });
      if (!response.ok) throw new Error(await response.text());
      setStatus('Мероприятие обновлено');
      await loadData();
      setPage('list');
      setReloadToken((value) => value + 1);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Не удалось обновить мероприятие');
    } finally {
      setBusy(false);
    }
  }

  function toggleSelectedTicket(rowLabel: string, seatLabel: string, requirePrice: boolean = true) {
    const currentPriceId = Number(saleChoice.price_option_id || activeEvent?.prices[0]?.id || 0);
    if (requirePrice && !currentPriceId) {
      setStatus('Выбери цену');
      return;
    }
    setSelectedRow(rowLabel);
    setSelectedSeat(seatLabel);
    setSelectedTickets((current) => {
      const exists = current.some((item) => item.row_label === rowLabel && item.seat_label === seatLabel);
      if (exists) {
        return current.filter((item) => !(item.row_label === rowLabel && item.seat_label === seatLabel));
      }
      return [...current, { row_label: rowLabel, seat_label: seatLabel, price_option_id: currentPriceId || 0 }];
    });
  }

  function toggleSelectedRowTickets(rowLabel: string) {
    const rowSeats = seats.filter((seat) => seat.row_label === rowLabel && seat.active && seat.status === 'free');
    if (rowSeats.length === 0) {
      setStatus(`В ряду ${rowLabel} нет свободных мест для продажи`);
      return;
    }

    const currentPriceId = Number(saleChoice.price_option_id || activeEvent?.prices[0]?.id || 0);
    if (!currentPriceId) {
      setStatus('Выбери цену');
      return;
    }

    setSelectedRow(rowLabel);
    setSelectedSeat(rowSeats[0]?.seat_label || '');
    setSelectedTickets((current) => {
      const rowKeys = new Set(rowSeats.map((seat) => `${seat.row_label}-${seat.seat_label}`));
      const selectedInRow = current.filter((item) => rowKeys.has(`${item.row_label}-${item.seat_label}`));
      const allSelected = selectedInRow.length === rowSeats.length;

      if (allSelected) {
        return current.filter((item) => !rowKeys.has(`${item.row_label}-${item.seat_label}`));
      }

      const existingKeys = new Set(current.map((item) => `${item.row_label}-${item.seat_label}`));
      const next = [...current];
      for (const seat of rowSeats) {
        const key = `${seat.row_label}-${seat.seat_label}`;
        if (!existingKeys.has(key)) {
          next.push({
            row_label: seat.row_label,
            seat_label: seat.seat_label,
            price_option_id: currentPriceId,
          });
        }
      }
      return next;
    });
  }

  function openCancelModeDialog() {
    setCancelModeConsent(false);
    setCancelModeDialogOpen(true);
  }

  function confirmCancelMode() {
    if (!cancelModeConsent) {
      setStatus('Подтверди разрешение на режим отмены');
      return;
    }
    setSaleMode('cancel');
    setSelectedTickets([]);
    setTicketPreviewUrl('');
    setCancelModeDialogOpen(false);
    setStatus('Режим отмены включён. Нажимай по проданным билетам.');
  }

  function switchToSellMode() {
    setSaleMode('sell');
    setSelectedTickets([]);
    setTicketPreviewUrl('');
    setCancelModeDialogOpen(false);
    setCancelModeConsent(false);
    setStatus('Режим продажи включён');
  }

  function switchToReserveMode() {
    setSaleMode('reserve');
    setSelectedTickets([]);
    setTicketPreviewUrl('');
    setCancelModeDialogOpen(false);
    setCancelModeConsent(false);
    setStatus('Режим резерва включён');
  }

  async function sellSelectedTickets() {
    if (selectedEventId === null || selectedTickets.length === 0) {
      setStatus('Выбери хотя бы одно место');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/tickets/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: selectedEventId,
          tickets: selectedTickets,
          printer_name: getPrinterName(),
          dither: printerDitherEnabled,
          ticket_gap_mm: printerTicketGapMm,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      const data = (await response.json()) as { preview_png_base64: string; job_id: string; sale_id: number | number[] };
      setTicketPreviewUrl(`data:image/png;base64,${data.preview_png_base64}`);
      setSelectedTickets([]);
      setSelectedRow('');
      setSelectedSeat('');
      setStatus(`Билеты проданы. Job: ${data.job_id}`);
      await loadEventDetail(selectedEventId);
      setReloadToken((value) => value + 1);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Ошибка продажи');
    } finally {
      setBusy(false);
    }
  }

  async function cancelSoldSeat(rowLabel: string, seatLabel: string) {
    if (selectedEventId === null) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/events/${selectedEventId}/seats/${rowLabel}/${seatLabel}/cancel`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error(await response.text());
      setStatus(`Билет ${rowLabel}-${seatLabel} отменён`);
      await loadEventDetail(selectedEventId);
      setReloadToken((value) => value + 1);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Ошибка отмены продажи');
    } finally {
      setBusy(false);
    }
  }

  async function cancelReservedSeat(rowLabel: string, seatLabel: string) {
    if (selectedEventId === null) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/events/${selectedEventId}/seats/${rowLabel}/${seatLabel}/cancel`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error(await response.text());
      setStatus(`Место ${rowLabel}-${seatLabel} снято с резерва`);
      await loadEventDetail(selectedEventId);
      setReloadToken((value) => value + 1);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Ошибка снятия резерва');
    } finally {
      setBusy(false);
    }
  }

  async function setSeatActiveState(rowLabel: string, seatLabel: string, active: boolean, status: SeatItem['status']) {
    if (selectedEventId === null) return;
    if (!active && status !== 'free') {
      setStatus('Отключать можно только свободные места');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/events/${selectedEventId}/seats/${rowLabel}/${seatLabel}/active`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      });
      if (!response.ok) throw new Error(await response.text());
      await loadEventDetail(selectedEventId);
      setStatus(`Место ${rowLabel}-${seatLabel} ${active ? 'включено' : 'отключено'}`);
      setReloadToken((value) => value + 1);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Не удалось изменить состояние места');
    } finally {
      setBusy(false);
    }
  }

  async function setRowActiveState(rowLabel: string, active: boolean) {
    if (selectedEventId === null) return;
    if (!active) {
      const rowSeats = seats.filter((seat) => seat.row_label === rowLabel);
      if (rowSeats.some((seat) => seat.status !== 'free')) {
        setStatus('Отключать ряд можно только если все места свободны');
        return;
      }
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/events/${selectedEventId}/rows/${rowLabel}/active`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      });
      if (!response.ok) throw new Error(await response.text());
      await loadEventDetail(selectedEventId);
      setStatus(`Ряд ${rowLabel} ${active ? 'включён' : 'отключён'}`);
      setReloadToken((value) => value + 1);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Не удалось изменить ряд');
    } finally {
      setBusy(false);
    }
  }

  async function setColumnActiveState(seatLabel: string, active: boolean) {
    if (selectedEventId === null) return;
    if (!active) {
      const columnSeats = seats.filter((seat) => seat.seat_label === seatLabel);
      if (columnSeats.some((seat) => seat.status !== 'free')) {
        setStatus('Отключать столбец можно только если все места свободны');
        return;
      }
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/events/${selectedEventId}/columns/${seatLabel}/active`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      });
      if (!response.ok) throw new Error(await response.text());
      await loadEventDetail(selectedEventId);
      setStatus(`Столбец ${seatLabel} ${active ? 'включён' : 'отключён'}`);
      setReloadToken((value) => value + 1);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Не удалось изменить столбец');
    } finally {
      setBusy(false);
    }
  }

  function getRowActiveState(rowLabel: string): 'active' | 'inactive' | 'mixed' {
    return getSeatRowState(seats, rowLabel);
  }

  function getColumnActiveState(seatLabel: string): 'active' | 'inactive' | 'mixed' {
    return getSeatColumnState(seats, seatLabel);
  }

  async function reserveSeat(rowLabel?: string, seatLabel?: string) {
    const nextRow = rowLabel || selectedRow;
    const nextSeat = seatLabel || selectedSeat;
    if (selectedEventId === null || !nextRow || !nextSeat) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/events/${selectedEventId}/seats/${nextRow}/${nextSeat}/reserve`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error(await response.text());
      setStatus(`Место ${nextRow}-${nextSeat} зарезервировано`);
      await loadEventDetail(selectedEventId);
      setReloadToken((value) => value + 1);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Ошибка брони');
    } finally {
      setBusy(false);
    }
  }

  async function cancelSeat(rowLabel?: string, seatLabel?: string) {
    const nextRow = rowLabel || selectedRow;
    const nextSeat = seatLabel || selectedSeat;
    if (selectedEventId === null || !nextRow || !nextSeat) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/events/${selectedEventId}/seats/${nextRow}/${nextSeat}/cancel`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error(await response.text());
      setStatus(`Место ${nextRow}-${nextSeat} освобождено`);
      await loadEventDetail(selectedEventId);
      setReloadToken((value) => value + 1);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Ошибка отмены');
    } finally {
      setBusy(false);
    }
  }

  async function reserveRow(rowLabel: string) {
    if (selectedEventId === null) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/events/${selectedEventId}/rows/${rowLabel}/reserve`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error(await response.text());
      setStatus(`Ряд ${rowLabel} поставлен в бронь`);
      await loadEventDetail(selectedEventId);
      setReloadToken((value) => value + 1);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Ошибка брони ряда');
    } finally {
      setBusy(false);
    }
  }

  async function releaseRow(rowLabel: string) {
    if (selectedEventId === null) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/events/${selectedEventId}/rows/${rowLabel}/release`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error(await response.text());
      setStatus(`Ряд ${rowLabel} возвращён в оборот`);
      await loadEventDetail(selectedEventId);
      setReloadToken((value) => value + 1);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Ошибка возврата ряда');
    } finally {
      setBusy(false);
    }
  }

  async function sellRow(rowLabel: string) {
    if (selectedEventId === null) return;
    const priceOptionId = Number(saleChoice.price_option_id || activeEvent?.prices[0]?.id || 0);
    if (!priceOptionId) {
      setStatus('Сначала выбери цену для продажи ряда');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/events/${selectedEventId}/rows/${rowLabel}/sell`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price_option_id: priceOptionId }),
      });
      if (!response.ok) throw new Error(await response.text());
      const data = (await response.json()) as { sales: Array<{ id: number }> };
      const soldCount = data.sales.length;
      setStatus(`Ряд ${rowLabel} продан: ${soldCount} мест`);
      await loadEventDetail(selectedEventId);
      setReloadToken((value) => value + 1);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Ошибка продажи ряда');
    } finally {
      setBusy(false);
    }
  }

  async function cancelSoldRow(rowLabel: string) {
    if (selectedEventId === null) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/events/${selectedEventId}/rows/${rowLabel}/cancel-sold`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error(await response.text());
      const data = (await response.json()) as { updated: number };
      setStatus(`В ряду ${rowLabel} отменено ${data.updated} проданных мест`);
      await loadEventDetail(selectedEventId);
      setReloadToken((value) => value + 1);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Ошибка отмены ряда');
    } finally {
      setBusy(false);
    }
  }

  async function printReportForEvent(eventId: number, eventTitle?: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/events/${eventId}/report/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printer_name: getPrinterName(),
          dither: printerDitherEnabled,
          report_mode: reportPrintMode,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      const data = (await response.json()) as { job_id: string; report_mode: 'combined' | 'separate' };
      setStatus(
        `Сводка${eventTitle ? ` "${eventTitle}"` : ''} отправлена в печать (${data.report_mode === 'combined' ? 'одной картинкой' : 'раздельно'}). Job: ${data.job_id}`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Ошибка печати сводки');
    } finally {
      setBusy(false);
    }
  }

  async function resetEventForEvent(eventId: number, eventTitle?: string) {
    const title = eventTitle || events.find((item) => item.id === eventId)?.title || 'это мероприятие';
    setSelectedEventId(eventId);
    setResetConfirmTitle(title);
    setResetConfirmEventId(eventId);
    setResetConfirmConsent(false);
    setResetConfirmOpen(true);
    setStatus(`Подтверди сброс "${title}"`);
  }

  async function confirmResetEvent(eventId: number) {
    if (!resetConfirmConsent) {
      setStatus('Подтверди разрешение на сброс');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/events/${eventId}/reset`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error(await response.text());
      if (selectedEventId === eventId) {
        setSelectedRow('');
        setSelectedSeat('');
        setSelectedTickets([]);
        setTicketPreviewUrl('');
        setSelectedEventId(null);
        setPage('list');
      }
      setStatus(`Мероприятие "${resetConfirmTitle || 'без названия'}" удалено`);
      await loadData();
      setReloadToken((value) => value + 1);
      setResetConfirmOpen(false);
      setResetConfirmConsent(false);
      setResetConfirmTitle('');
      setResetConfirmEventId(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Ошибка удаления мероприятия');
    } finally {
      setBusy(false);
    }
  }

  const selectedSeatRecord = seats.find((seat) => seat.row_label === selectedRow && seat.seat_label === selectedSeat) || null;
  const selectedSeatDisplayLabel =
    displayHall.find((row) => row.label === selectedRow)?.seats.find((seat) => seat.seat_label === selectedSeat)?.display_label ||
    (selectedSeatRecord ? selectedSeatRecord.seat_label : '—');
  const selectedTicketViews = selectedTickets.map((ticket) => {
    const price = activeEvent?.prices.find((item) => item.id === ticket.price_option_id) || null;
    const displaySeat =
      displayHall.find((row) => row.label === ticket.row_label)?.seats.find((seat) => seat.seat_label === ticket.seat_label)
        ?.display_label || ticket.seat_label;
    return {
      ...ticket,
      seat_display_label: displaySeat,
      price_label: price?.label || 'Цена',
      amount_cents: price?.amount_cents || 0,
    };
  });
  const settingsLayoutPreviewImage =
    settingsTemplatePreviewUrl ||
    (hallSettings.default_ticket_template_path ? `/api/hall-settings/template-image?v=${reloadToken}` : '');
  const createLayoutPreviewImage = createTemplatePreviewUrl || settingsLayoutPreviewImage;
  const editLayoutPreviewImage =
    editTemplatePreviewUrl || (selectedEventId !== null ? `/api/events/${selectedEventId}/template-image?v=${reloadToken}` : '');

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">касса / билеты</div>
          <h1>Система продажи билетов</h1>
        </div>
        <div className="topbar-actions">
          <nav className="tabs">
            <button type="button" className={page === 'list' ? 'tab active' : 'tab'} onClick={() => setPage('list')}>
              Мероприятия
            </button>
            <button type="button" className={page === 'create' ? 'tab active' : 'tab'} onClick={() => setPage('create')}>
              Создать
            </button>
            <button type="button" className={page === 'settings' ? 'tab active' : 'tab'} onClick={() => setPage('settings')}>
              Шаблон мероприятия
            </button>
            <button type="button" className={page === 'report-settings' ? 'tab active' : 'tab'} onClick={() => setPage('report-settings')}>
              Настройки сводки
            </button>
          </nav>
          <button type="button" className="ghost printer-button" onClick={() => setPrinterPickerOpen(true)}>
            Принтер: {getPrinterName() || 'не выбран'}
          </button>
        </div>
      </header>

      {page === 'list' ? (
        <EventsListPage
          events={events}
          busy={busy}
          reloadToken={reloadToken}
          onOpenCreate={() => setPage('create')}
          onOpenSale={openSalePage}
          onOpenEdit={openEditPage}
          onPrintReport={(eventId, eventTitle) => void printReportForEvent(eventId, eventTitle)}
          onResetEvent={(eventId, eventTitle) => void resetEventForEvent(eventId, eventTitle)}
        />
      ) : null}

      {page === 'create' ? (
        <CreateEventPage
          busy={busy}
          createDraft={createDraft}
          createHallRows={createHallRows}
          createHallSeats={createHallSeats}
          createPrices={createPrices}
          createTicketLayout={createTicketLayout}
          createLayoutPreviewImage={createLayoutPreviewImage}
          createHallPreview={createHallPreview}
          onBack={() => setPage('list')}
          onSubmit={submitCreate}
          onCreateDraftChange={setCreateDraft}
          onCreateTemplateChange={setCreateTemplate}
          onApplyHallPreset={applyHallPreset}
          onCreateHallRowsChange={setCreateHallRows}
          onCreateHallSeatsChange={setCreateHallSeats}
          onToggleCreateSeat={toggleCreateSeat}
          onCreateTicketLayoutChange={setCreateTicketLayout}
          onCreatePricesChange={setCreatePrices}
        />
      ) : null}

      {page === 'settings' ? (
        <TemplateSettingsPage
          busy={busy}
          hallSettings={hallSettings}
          settingsRows={settingsRows}
          settingsSeats={settingsSeats}
          settingsPrices={settingsPrices}
          settingsTicketLayout={settingsTicketLayout}
          settingsTemplatePreviewUrl={settingsTemplatePreviewUrl}
          settingsRenderedPreviewUrl={settingsRenderedPreviewUrl}
          settingsLayoutPreviewImage={settingsLayoutPreviewImage}
          settingsColumnLabels={settingsColumnLabels}
          settingsHallPreview={settingsHallPreview}
          onBack={() => setPage('list')}
          onSubmit={saveHallSettings}
          onSettingsRowsChange={setSettingsRows}
          onSettingsSeatsChange={setSettingsSeats}
          onSettingsTemplateFileChange={setSettingsTemplateFile}
          onSettingsTicketLayoutChange={setSettingsTicketLayout}
          onSettingsPricesChange={setSettingsPrices}
          onToggleSettingsColumn={toggleSettingsColumn}
          onGetSettingsColumnState={getSettingsColumnState}
          onToggleSettingsRow={toggleSettingsRow}
          onGetSettingsRowState={getSettingsRowState}
          onToggleSettingsSeat={toggleSettingsSeat}
        />
      ) : null}

      {page === 'report-settings' ? (
        <ReportSettingsPage
          busy={busy}
          reportFontSize={reportFontSize}
          reportPreviewUrl={reportPreviewUrl}
          onBack={() => setPage('list')}
          onSubmit={saveReportSettings}
          onReportFontSizeChange={setReportFontSize}
        />
      ) : null}

      {page === 'edit' && selectedEventId !== null ? (
        <EditEventPage
          busy={busy}
          activeEvent={activeEvent}
          editDraft={editDraft}
          editTemplatePreviewUrl={editTemplatePreviewUrl}
          editRenderedPreviewUrl={editRenderedPreviewUrl}
          editLayoutPreviewImage={editLayoutPreviewImage}
          editTicketLayout={editTicketLayout}
          displayHall={displayHall}
          editorColumnLabels={editorColumnLabels}
          onBack={() => setPage('list')}
          onSubmit={submitEdit}
          onEditDraftChange={setEditDraft}
          onEditTemplateChange={setEditTemplate}
          onEditTicketLayoutChange={setEditTicketLayout}
          onGetColumnActiveState={getColumnActiveState}
          onSetColumnActiveState={(seatLabel, active) => void setColumnActiveState(seatLabel, active)}
          onGetRowActiveState={getRowActiveState}
          onSetRowActiveState={(rowLabel, active) => void setRowActiveState(rowLabel, active)}
          onSetSeatActiveState={(rowLabel, seatLabel, active, status) => void setSeatActiveState(rowLabel, seatLabel, active, status)}
        />
      ) : null}

      {page === 'sale' && selectedEventId !== null ? (
        <SalePage
          busy={busy}
          activeEvent={activeEvent}
          seats={seats}
          displayHall={displayHall}
          selectedRow={selectedRow}
          selectedSeatDisplayLabel={selectedSeatDisplayLabel}
          selectedSeatRecord={selectedSeatRecord}
          selectedTickets={selectedTickets}
          selectedTicketViews={selectedTicketViews}
          saleMode={saleMode}
          saleChoicePriceOptionId={saleChoice.price_option_id}
          ticketPreviewUrl={ticketPreviewUrl}
          onBack={() => setPage('list')}
          onSwitchToSellMode={switchToSellMode}
          onSwitchToReserveMode={switchToReserveMode}
          onOpenCancelModeDialog={openCancelModeDialog}
          onSaleChoiceChange={(value) => setSaleChoice({ price_option_id: value })}
          onSellSelectedTickets={() => void sellSelectedTickets()}
          onReserveSeat={(rowLabel, seatLabel) => {
            setSelectedRow(rowLabel);
            setSelectedSeat(seatLabel);
            void reserveSeat(rowLabel, seatLabel);
          }}
          onToggleSellRow={toggleSelectedRowTickets}
          onReserveRow={(rowLabel) => void reserveRow(rowLabel)}
          onReleaseRow={(rowLabel) => void releaseRow(rowLabel)}
          onCancelSoldRow={(rowLabel) => void cancelSoldRow(rowLabel)}
          onCancelSoldSeat={(rowLabel, seatLabel) => void cancelSoldSeat(rowLabel, seatLabel)}
          onCancelReservedSeat={(rowLabel, seatLabel) => void cancelSeat(rowLabel, seatLabel)}
          onToggleSelectedTicket={toggleSelectedTicket}
          onSetSelectedSeat={(rowLabel, seatLabel) => {
            setSelectedRow(rowLabel);
            setSelectedSeat(seatLabel);
          }}
          onSetStatus={setStatus}
          onGetRowActiveState={getRowActiveState}
        />
      ) : null}

      <PrinterDialog
        open={printerPickerOpen}
        printers={printers}
        selectedPrinter={selectedPrinter}
        printerTicketGapMm={printerTicketGapMm}
        printerDitherEnabled={printerDitherEnabled}
        reportPrintMode={reportPrintMode}
        onClose={() => setPrinterPickerOpen(false)}
        onRefresh={() => void loadData()}
        onOpenSystemSettings={() => void openPrinterSystemSettings()}
        onSelectPrinter={choosePrinter}
        onSelectGap={choosePrinterGap}
        onSelectDither={choosePrinterDither}
        onSelectReportPrintMode={chooseReportPrintMode}
      />

      <PermissionDialog
        open={cancelModeDialogOpen}
        title="Включить режим отмены?"
        description="Этот режим отменяет уже проданные билеты. Подтверди, что у тебя есть разрешение на такие действия."
        consentLabel="У меня есть разрешение на отмену проданных билетов"
        consent={cancelModeConsent}
        onClose={() => {
          setCancelModeDialogOpen(false);
          setCancelModeConsent(false);
        }}
        onConsentChange={setCancelModeConsent}
        onConfirm={confirmCancelMode}
      />

      <PermissionDialog
        open={resetConfirmOpen}
        busy={busy}
        title="Сбросить мероприятие?"
        description="Это удалит мероприятие, все продажи, схему, цены и картинку. Подтверди, что у тебя есть разрешение на этот сброс."
        consentLabel="У меня есть разрешение на полный сброс мероприятия"
        consent={resetConfirmConsent}
        onClose={() => {
          setResetConfirmOpen(false);
          setResetConfirmConsent(false);
          setResetConfirmTitle('');
          setResetConfirmEventId(null);
        }}
        onConsentChange={setResetConfirmConsent}
        onConfirm={() => void confirmResetEvent(resetConfirmEventId || 0)}
      />

      {status ? <div className="status-banner">{status}</div> : null}
      {busy ? <div className="busy-indicator">Загрузка...</div> : null}
    </div>
  );
}
