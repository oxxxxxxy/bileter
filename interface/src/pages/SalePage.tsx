import type { EventItem, SeatItem, SeatRow, SelectedTicket } from '../types';
import { formatMoney, seatStateLabel } from '../utils/format';

type SelectedTicketView = SelectedTicket & {
  seat_display_label: string;
  price_label: string;
  amount_cents: number;
};

type SalePageProps = {
  busy: boolean;
  activeEvent: EventItem | null;
  seats: SeatItem[];
  displayHall: SeatRow[];
  selectedRow: string;
  selectedSeatDisplayLabel: string;
  selectedSeatRecord: SeatItem | null;
  selectedTickets: SelectedTicket[];
  selectedTicketViews: SelectedTicketView[];
  saleMode: 'sell' | 'cancel' | 'reserve';
  saleChoicePriceOptionId: string;
  ticketPreviewUrl: string;
  onBack: () => void;
  onSwitchToSellMode: () => void;
  onSwitchToReserveMode: () => void;
  onOpenCancelModeDialog: () => void;
  onSaleChoiceChange: (value: string) => void;
  onSellSelectedTickets: () => void;
  onReserveSeat: (rowLabel: string, seatLabel: string) => void;
  onToggleSellRow: (rowLabel: string) => void;
  onReserveRow: (rowLabel: string) => void;
  onReleaseRow: (rowLabel: string) => void;
  onCancelSoldRow: (rowLabel: string) => void;
  onCancelSoldSeat: (rowLabel: string, seatLabel: string) => void;
  onCancelReservedSeat: (rowLabel: string, seatLabel: string) => void;
  onToggleSelectedTicket: (rowLabel: string, seatLabel: string, requirePrice?: boolean) => void;
  onSetSelectedSeat: (rowLabel: string, seatLabel: string) => void;
  onSetStatus: (value: string) => void;
  onGetRowActiveState: (rowLabel: string) => 'active' | 'inactive' | 'mixed';
};

export function SalePage({
  busy,
  activeEvent,
  seats,
  displayHall,
  selectedRow,
  selectedSeatDisplayLabel,
  selectedSeatRecord,
  selectedTickets,
  selectedTicketViews,
  saleMode,
  saleChoicePriceOptionId,
  ticketPreviewUrl,
  onBack,
  onSwitchToSellMode,
  onSwitchToReserveMode,
  onOpenCancelModeDialog,
  onSaleChoiceChange,
  onSellSelectedTickets,
  onReserveSeat,
  onToggleSellRow,
  onReserveRow,
  onReleaseRow,
  onCancelSoldRow,
  onCancelSoldSeat,
  onCancelReservedSeat,
  onToggleSelectedTicket,
  onSetSelectedSeat,
  onSetStatus,
  onGetRowActiveState,
}: SalePageProps) {
  return (
    <main className="page sale-page">
      <section className="panel sale-left">
        <div className="panel-head">
          <div>
            <div className="eyebrow">продажа</div>
            <h2>{activeEvent?.title || 'Без названия'}</h2>
          </div>
          <button type="button" className="ghost back-button" onClick={onBack}>
            Назад
          </button>
        </div>

        <div className="selection-strip">
          <div>
            <span>Ряд</span>
            <strong>{selectedRow || '—'}</strong>
          </div>
          <div>
            <span>Место</span>
            <strong>{selectedSeatDisplayLabel}</strong>
          </div>
          <div>
            <span>Статус</span>
            <strong>{selectedSeatRecord ? seatStateLabel(selectedSeatRecord.status) : '—'}</strong>
          </div>
        </div>
        <div className="mode-bar">
          <button type="button" className={saleMode === 'sell' ? 'mode-button active' : 'mode-button'} onClick={onSwitchToSellMode}>
            Режим продажи
          </button>
          <button
            type="button"
            className={saleMode === 'reserve' ? 'mode-button reserve active' : 'mode-button reserve'}
            onClick={() => {
              if (saleMode === 'reserve') {
                onSwitchToSellMode();
                return;
              }
              onSwitchToReserveMode();
            }}
          >
            Режим резерва
          </button>
          <button
            type="button"
            className={saleMode === 'cancel' ? 'mode-button danger active' : 'mode-button danger'}
            onClick={() => {
              if (saleMode === 'cancel') {
                onSwitchToSellMode();
                return;
              }
              onOpenCancelModeDialog();
            }}
          >
            Режим отмены
          </button>
        </div>
        {saleMode === 'cancel' ? <div className="mode-hint danger-text">Режим отмены: нажимай только по проданным билетам.</div> : null}
        {saleMode === 'reserve' ? <div className="mode-hint reserve-text">Режим резерва: клик по свободному месту ставит бронь, клик по броне снимает её.</div> : null}
        {saleMode === 'sell' ? <div className="selected-count">Выбрано билетов: {selectedTickets.length}</div> : null}

        {saleMode === 'sell' ? (
          <label className="field">
            <span>Цена при продаже</span>
            <select value={saleChoicePriceOptionId} onChange={(e) => onSaleChoiceChange(e.target.value)}>
              <option value="">Выбери цену</option>
              {activeEvent?.prices.map((price) => (
                <option key={price.id} value={price.id}>
                  {price.label} · {formatMoney(price.amount_cents)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {saleMode === 'sell' ? (
          <div className="selected-ticket-list">
            <div className="section-title">Билеты к печати</div>
            {selectedTicketViews.length === 0 ? (
              <div className="muted">Нажимай места на схеме, чтобы добавить их в продажу.</div>
            ) : (
              selectedTicketViews.map((ticket) => (
                <div className="selected-ticket-row" key={`${ticket.row_label}-${ticket.seat_label}`}>
                  <div>
                    <strong>Ряд {ticket.row_label}</strong>
                    <span>Место {ticket.seat_display_label}</span>
                  </div>
                  <div className="selected-ticket-price">
                    <span>{ticket.price_label}</span>
                    <strong>{formatMoney(ticket.amount_cents)}</strong>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}

        <div className="sale-actions">
          {saleMode === 'cancel' ? (
            <button type="button" className="ghost" onClick={onSwitchToSellMode} disabled={busy}>
              Вернуться к продаже
            </button>
          ) : null}
          {saleMode === 'reserve' ? (
            <button type="button" className="ghost" onClick={onSwitchToSellMode} disabled={busy}>
              Вернуться к продаже
            </button>
          ) : null}
        </div>

        <div className="sale-preview-block">
          {saleMode === 'sell' && ticketPreviewUrl ? (
            <img className="preview-image" src={ticketPreviewUrl} alt="ticket preview" />
          ) : saleMode === 'sell' ? (
            <div className="placeholder">Превью билета загружается</div>
          ) : saleMode === 'reserve' ? (
            <div className="placeholder">Режим резерва активен. Нажимай свободные места, чтобы ставить бронь, и места в броне, чтобы снимать её.</div>
          ) : (
            <div className="placeholder">Режим отмены активен. Нажимай проданные места на схеме.</div>
          )}
          {saleMode === 'sell' ? (
            <button
              type="button"
              className="sale-print-button"
              onClick={onSellSelectedTickets}
              disabled={busy || selectedTickets.length === 0}
            >
              Печать {selectedTickets.length || ''}
            </button>
          ) : null}
        </div>
      </section>

      <section className="panel sale-center">
        <div className="panel-head">
          <div>
            <div className="eyebrow">схема зала</div>
            <h2>Выбор места</h2>
          </div>
          <div className="legend">
            <span className="legend-item free">свободно</span>
            <span className="legend-item reserved">бронь</span>
            <span className="legend-item sold">продано</span>
          </div>
        </div>

        <div className="hall">
          <div className="hall-stage">СЦЕНА</div>
          {displayHall.map((row) => (
            <div className="hall-row" key={row.label}>
              {(() => {
                const rowState = onGetRowActiveState(row.label);
                const reserved = seats.some((seat) => seat.row_label === row.label && seat.status === 'reserved');
                const sold = seats.some((seat) => seat.row_label === row.label && seat.status === 'sold');
                return (
                  <button
                    type="button"
                    className={`row-pill ${rowState === 'active' ? 'active' : ''} ${rowState === 'inactive' ? 'inactive' : ''} ${rowState === 'mixed' ? 'mixed' : ''}`}
                    onClick={() => {
                      if (rowState === 'inactive') return;
                      if (saleMode === 'cancel') {
                        if (!sold) {
                          onSetStatus(`В ряду ${row.label} нет проданных мест`);
                          return;
                        }
                        onCancelSoldRow(row.label);
                        return;
                      }
                      if (saleMode === 'reserve') {
                        if (reserved) {
                          onReleaseRow(row.label);
                          return;
                        }
                        onReserveRow(row.label);
                        return;
                      }
                      onToggleSellRow(row.label);
                    }}
                    disabled={busy || rowState === 'inactive'}
                  >
                    {saleMode === 'cancel' ? `Отмена ${row.label}` : reserved && saleMode === 'reserve' ? `Снять ${row.label}` : `Ряд ${row.label}`}
                  </button>
                );
              })()}
              <div className="seat-strip">
                {row.seats.map((cell) => {
                  const record = seats.find((seat) => seat.row_label === row.label && seat.seat_label === cell.seat_label);
                  const selected = saleMode === 'sell'
                    ? selectedTickets.some((item) => item.row_label === row.label && item.seat_label === cell.seat_label)
                    : false;
                  const cls = record ? `seat-${record.status}` : 'seat-free';
                  const inactive = record ? !record.active : true;
                  return (
                    <button
                      type="button"
                      key={`${row.label}-${cell.seat_label}`}
                      disabled={inactive}
                      className={`seat ${cls} ${inactive ? 'seat-inactive' : ''} ${selected ? 'selected' : ''}`}
                      onClick={() => {
                        if (inactive) {
                          onSetStatus(`Место ${row.label}-${cell.seat_label} отключено`);
                          return;
                        }
                        if (saleMode === 'cancel') {
                          if (record?.status === 'sold') {
                            onSetSelectedSeat(row.label, cell.seat_label);
                            onCancelSoldSeat(row.label, cell.seat_label);
                            return;
                          }
                          onSetStatus('В режиме отмены можно нажимать только проданные места');
                          return;
                        }
                        if (saleMode === 'reserve') {
                          if (record?.status === 'reserved') {
                            onSetSelectedSeat(row.label, cell.seat_label);
                            onCancelReservedSeat(row.label, cell.seat_label);
                            return;
                          }
                          if (record?.status === 'sold') {
                            onSetStatus(`Место ${row.label}-${cell.seat_label} уже продано`);
                            return;
                          }
                          onSetSelectedSeat(row.label, cell.seat_label);
                          onReserveSeat(row.label, cell.seat_label);
                          return;
                        }
                        if (record?.status === 'sold') {
                          onSetStatus(`Место ${row.label}-${cell.seat_label} уже продано`);
                          return;
                        }
                        if (record?.status === 'reserved') {
                          onSetStatus(`Место ${row.label}-${cell.seat_label} в брони`);
                          return;
                        }
                        if (activeEvent?.prices[0] && !saleChoicePriceOptionId) {
                          onSaleChoiceChange(String(activeEvent.prices[0].id));
                        }
                        onToggleSelectedTicket(row.label, cell.seat_label, true);
                      }}
                    >
                      {cell.display_label}
                    </button>
                  );
                })}
              </div>
              <span className="row-spacer" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
