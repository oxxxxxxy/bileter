import type { FormEvent } from 'react';

import { HALL_PRESETS } from '../constants';
import { TicketLayoutInputs, TicketLayoutPreview } from '../components/TicketLayoutControls';
import type { EventDraft, HallPreviewRow, PriceDraft, TicketLayout } from '../types';

type CreateEventPageProps = {
  busy: boolean;
  createDraft: EventDraft;
  createHallRows: string;
  createHallSeats: string;
  createPrices: PriceDraft[];
  createTicketLayout: TicketLayout;
  createLayoutPreviewImage: string;
  createHallPreview: HallPreviewRow[];
  onBack: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCreateDraftChange: (draft: EventDraft) => void;
  onCreateTemplateChange: (file: File | null) => void;
  onApplyHallPreset: (rows: number, seats: number) => void;
  onCreateHallRowsChange: (value: string) => void;
  onCreateHallSeatsChange: (value: string) => void;
  onToggleCreateSeat: (rowLabel: string, seatLabel: string) => void;
  onCreateTicketLayoutChange: (layout: TicketLayout) => void;
  onCreatePricesChange: (prices: PriceDraft[]) => void;
};

export function CreateEventPage({
  busy,
  createDraft,
  createHallRows,
  createHallSeats,
  createPrices,
  createTicketLayout,
  createLayoutPreviewImage,
  createHallPreview,
  onBack,
  onSubmit,
  onCreateDraftChange,
  onCreateTemplateChange,
  onApplyHallPreset,
  onCreateHallRowsChange,
  onCreateHallSeatsChange,
  onToggleCreateSeat,
  onCreateTicketLayoutChange,
  onCreatePricesChange,
}: CreateEventPageProps) {
  return (
    <main className="page form-page">
      <section className="panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">создание</div>
            <h2>Новое мероприятие</h2>
          </div>
          <button type="button" className="ghost back-button" onClick={onBack}>
            Назад
          </button>
        </div>

        <form className="form-grid" onSubmit={onSubmit}>
          <label className="field">
            <span>Название мероприятия (необязательно)</span>
            <input value={createDraft.title} onChange={(e) => onCreateDraftChange({ ...createDraft, title: e.target.value })} />
          </label>
          <label className="field">
            <span>Картинка билета</span>
            <input type="file" accept="image/*" onChange={(e) => onCreateTemplateChange(e.target.files?.[0] || null)} />
          </label>
          <div className="card-inner">
            <div className="section-title">Быстрый пресет</div>
            <div className="preset-row">
              {HALL_PRESETS.map((preset) => (
                <button key={preset.id} type="button" className="ghost small" onClick={() => onApplyHallPreset(preset.rows, preset.seats)}>
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <div className="price-row">
            <label className="field">
              <span>Ряды</span>
              <input type="number" min="1" value={createHallRows} onChange={(e) => onCreateHallRowsChange(e.target.value)} />
            </label>
            <label className="field">
              <span>Места в ряду</span>
              <input type="number" min="1" value={createHallSeats} onChange={(e) => onCreateHallSeatsChange(e.target.value)} />
            </label>
          </div>

          <div className="card-inner scheme-editor">
            <div className="section-title">Схема зала по умолчанию</div>
            <div className="muted">Нажимай на места, чтобы выключать их. Нумерация сохранится.</div>
            <div className="hall hall-editor create-hall">
              {createHallPreview.map((row) => (
                <div className="hall-row" key={`create-${row.label}`}>
                  <button type="button" className="row-pill active" disabled>
                    Ряд {row.label}
                  </button>
                  <div className="seat-strip">
                    {row.seats.map((cell) => {
                      const inactive = !cell.active;
                      return (
                        <button
                          type="button"
                          key={`create-${row.label}-${cell.label}`}
                          className={`seat seat-free ${inactive ? 'seat-inactive' : ''}`}
                          onClick={() => onToggleCreateSeat(row.label, cell.label)}
                        >
                          {cell.displayLabel}
                        </button>
                      );
                    })}
                  </div>
                  <span className="row-spacer" />
                </div>
              ))}
            </div>
          </div>

          <div className="card-inner">
            <div className="section-title">Печать билета</div>
            <div className="muted">Координаты считаются от верхнего левого угла билета. Размер задаётся числом.</div>
            <TicketLayoutPreview imageUrl={createLayoutPreviewImage} layout={createTicketLayout} />
            <TicketLayoutInputs layout={createTicketLayout} onChange={onCreateTicketLayoutChange} scope="create" />
          </div>

          <div className="card-inner">
            <div className="section-title">Варианты цены</div>
            {createPrices.map((price, index) => (
              <div className="price-row" key={`create-price-${index}`}>
                <input
                  value={price.label}
                  onChange={(e) => {
                    const next = [...createPrices];
                    next[index] = { ...price, label: e.target.value };
                    onCreatePricesChange(next);
                  }}
                  placeholder="Тип"
                />
                <input
                  type="number"
                  value={price.amount}
                  onChange={(e) => {
                    const next = [...createPrices];
                    next[index] = { ...price, amount: e.target.value };
                    onCreatePricesChange(next);
                  }}
                  placeholder="Сумма"
                />
                <button type="button" className="ghost small" onClick={() => onCreatePricesChange(createPrices.filter((_, i) => i !== index))}>
                  ×
                </button>
              </div>
            ))}
            <button type="button" className="ghost wide" onClick={() => onCreatePricesChange([...createPrices, { label: '', amount: '0' }])}>
              Добавить цену
            </button>
          </div>

          <button type="submit" disabled={busy}>
            Создать
          </button>
        </form>
      </section>
    </main>
  );
}
