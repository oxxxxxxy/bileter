import type { FormEvent } from 'react';

import { TicketLayoutInputs, TicketRenderedPreview } from '../components/TicketLayoutControls';
import type { EventDraft, EventItem, SeatRow, TicketLayout } from '../types';
import { formatMoney } from '../utils/format';

type EditEventPageProps = {
  busy: boolean;
  activeEvent: EventItem | null;
  editDraft: EventDraft;
  editTemplatePreviewUrl: string;
  editRenderedPreviewUrl: string;
  editLayoutPreviewImage: string;
  editTicketLayout: TicketLayout;
  displayHall: SeatRow[];
  editorColumnLabels: string[];
  onBack: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onEditDraftChange: (draft: EventDraft) => void;
  onEditTemplateChange: (file: File | null) => void;
  onEditTicketLayoutChange: (layout: TicketLayout) => void;
  onGetColumnActiveState: (seatLabel: string) => 'active' | 'inactive' | 'mixed';
  onSetColumnActiveState: (seatLabel: string, active: boolean) => void;
  onGetRowActiveState: (rowLabel: string) => 'active' | 'inactive' | 'mixed';
  onSetRowActiveState: (rowLabel: string, active: boolean) => void;
  onSetSeatActiveState: (rowLabel: string, seatLabel: string, active: boolean, status: 'free' | 'reserved' | 'sold') => void;
};

export function EditEventPage({
  busy,
  activeEvent,
  editDraft,
  editTemplatePreviewUrl,
  editRenderedPreviewUrl,
  editLayoutPreviewImage,
  editTicketLayout,
  displayHall,
  editorColumnLabels,
  onBack,
  onSubmit,
  onEditDraftChange,
  onEditTemplateChange,
  onEditTicketLayoutChange,
  onGetColumnActiveState,
  onSetColumnActiveState,
  onGetRowActiveState,
  onSetRowActiveState,
  onSetSeatActiveState,
}: EditEventPageProps) {
  return (
    <main className="page form-page">
      <section className="panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">редактирование</div>
            <h2>{activeEvent?.title || 'Мероприятие без названия'}</h2>
          </div>
          <button type="button" className="ghost back-button" onClick={onBack}>
            Назад
          </button>
        </div>

        <form className="form-grid" onSubmit={onSubmit}>
          <label className="field">
            <span>Название мероприятия</span>
            <input value={editDraft.title} onChange={(e) => onEditDraftChange({ ...editDraft, title: e.target.value })} />
          </label>
          <label className="field">
            <span>Новая картинка</span>
            <input type="file" accept="image/*" onChange={(e) => onEditTemplateChange(e.target.files?.[0] || null)} />
          </label>

          <div className="card-inner">
            <div className="section-title">Текущие цены</div>
            {activeEvent?.prices.map((price) => (
              <div className="read-only-row" key={price.id}>
                <span>{price.label}</span>
                <strong>{formatMoney(price.amount_cents)}</strong>
              </div>
            ))}
          </div>

          <div className="card-inner">
            <div className="section-title">Печать билета</div>
            <div className="muted">Здесь можно переопределить позицию и размер надписей для этого мероприятия.</div>
            {editTemplatePreviewUrl ? (
              <TicketRenderedPreview imageUrl={editLayoutPreviewImage} layout={editTicketLayout} />
            ) : editRenderedPreviewUrl ? (
              <img className="preview-image" src={editRenderedPreviewUrl} alt="ticket preview" />
            ) : (
              <div className="placeholder">Превью билета загружается</div>
            )}
            <TicketLayoutInputs layout={editTicketLayout} onChange={onEditTicketLayoutChange} scope="edit" />
          </div>

          <button type="submit" disabled={busy}>
            Сохранить
          </button>
        </form>

        <div className="card-inner scheme-editor">
          <div className="section-title">Схема зала</div>
          <div className="muted">Отключай места, целые ряды или столбцы. Сетка не меняется, место просто становится неактивным.</div>
          <div className="column-toolbar">
            <span className="toolbar-spacer" />
            <div className="column-strip">
              {editorColumnLabels.map((label) => {
                const state = onGetColumnActiveState(label);
                const active = state === 'active';
                return (
                  <button
                    type="button"
                    key={`col-${label}`}
                    className={`column-pill ${state === 'active' ? 'active' : ''} ${state === 'inactive' ? 'inactive' : ''} ${state === 'mixed' ? 'mixed' : ''}`}
                    onClick={() => onSetColumnActiveState(label, !active)}
                    disabled={busy}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <span className="toolbar-spacer" />
          </div>
          <div className="hall hall-editor">
            <div className="hall-stage">СЦЕНА</div>
            {displayHall.map((row) => (
              <div className="hall-row" key={row.label}>
                {(() => {
                  const state = onGetRowActiveState(row.label);
                  const active = state === 'active';
                  return (
                    <button
                      type="button"
                      className={`row-pill ${state === 'active' ? 'active' : ''} ${state === 'inactive' ? 'inactive' : ''} ${state === 'mixed' ? 'mixed' : ''}`}
                      onClick={() => onSetRowActiveState(row.label, !active)}
                      disabled={busy}
                    >
                      Ряд {row.label}
                    </button>
                  );
                })()}
                <div className="seat-strip">
                  {row.seats.map((cell) => {
                    const cls = `seat seat-${cell.status}`;
                    const inactive = !cell.active;
                    return (
                      <button
                        type="button"
                        key={`${row.label}-${cell.seat_label}`}
                        className={`${cls} ${inactive ? 'seat-inactive' : ''}`}
                        onClick={() => onSetSeatActiveState(row.label, cell.seat_label, !cell.active, cell.status)}
                        disabled={busy}
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
        </div>
      </section>
    </main>
  );
}
