import type { FormEvent } from 'react';

import { TicketLayoutInputs, TicketRenderedPreview } from '../components/TicketLayoutControls';
import type { HallPreviewRow, HallSettingsData, PriceDraft, TicketLayout } from '../types';

type TemplateSettingsPageProps = {
  busy: boolean;
  hallSettings: HallSettingsData;
  settingsRows: string;
  settingsSeats: string;
  settingsPrices: PriceDraft[];
  settingsTicketLayout: TicketLayout;
  settingsTemplatePreviewUrl: string;
  settingsRenderedPreviewUrl: string;
  settingsLayoutPreviewImage: string;
  settingsColumnLabels: string[];
  settingsHallPreview: HallPreviewRow[];
  onBack: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSettingsRowsChange: (value: string) => void;
  onSettingsSeatsChange: (value: string) => void;
  onSettingsTemplateFileChange: (file: File | null) => void;
  onSettingsTicketLayoutChange: (layout: TicketLayout) => void;
  onSettingsPricesChange: (prices: PriceDraft[]) => void;
  onToggleSettingsColumn: (seatLabel: string) => void;
  onGetSettingsColumnState: (seatLabel: string) => 'active' | 'inactive' | 'mixed';
  onToggleSettingsRow: (rowLabel: string) => void;
  onGetSettingsRowState: (rowLabel: string) => 'active' | 'inactive' | 'mixed';
  onToggleSettingsSeat: (rowLabel: string, seatLabel: string) => void;
};

export function TemplateSettingsPage({
  busy,
  hallSettings,
  settingsRows,
  settingsSeats,
  settingsPrices,
  settingsTicketLayout,
  settingsTemplatePreviewUrl,
  settingsRenderedPreviewUrl,
  settingsLayoutPreviewImage,
  settingsColumnLabels,
  settingsHallPreview,
  onBack,
  onSubmit,
  onSettingsRowsChange,
  onSettingsSeatsChange,
  onSettingsTemplateFileChange,
  onSettingsTicketLayoutChange,
  onSettingsPricesChange,
  onToggleSettingsColumn,
  onGetSettingsColumnState,
  onToggleSettingsRow,
  onGetSettingsRowState,
  onToggleSettingsSeat,
}: TemplateSettingsPageProps) {
  return (
    <main className="page form-page">
      <section className="panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">шаблон</div>
            <h2>Мероприятие по умолчанию</h2>
          </div>
          <button type="button" className="ghost back-button" onClick={onBack}>
            Назад
          </button>
        </div>

        <form className="form-grid" onSubmit={onSubmit}>
          <div className="price-row">
            <label className="field">
              <span>Ряды по умолчанию</span>
              <input type="number" min="1" value={settingsRows} onChange={(e) => onSettingsRowsChange(e.target.value)} />
            </label>
            <label className="field">
              <span>Места в ряду по умолчанию</span>
              <input type="number" min="1" value={settingsSeats} onChange={(e) => onSettingsSeatsChange(e.target.value)} />
            </label>
          </div>

          <div className="card-inner scheme-editor">
            <div className="section-title">Схема зала по умолчанию</div>
            <div className="muted">Это базовый шаблон для всех будущих мероприятий. Нажимай на места, чтобы выключать их.</div>
            <div className="column-toolbar">
              <span className="toolbar-spacer" />
              <div className="column-strip">
                {settingsColumnLabels.map((label) => {
                  const state = onGetSettingsColumnState(label);
                  return (
                    <button
                      type="button"
                      key={`settings-col-${label}`}
                      className={`column-pill ${state === 'active' ? 'active' : ''} ${state === 'inactive' ? 'inactive' : ''} ${state === 'mixed' ? 'mixed' : ''}`}
                      onClick={() => onToggleSettingsColumn(label)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <span className="toolbar-spacer" />
            </div>
            <div className="hall hall-editor create-hall">
              {settingsHallPreview.map((row) => (
                <div className="hall-row" key={`settings-${row.label}`}>
                  {(() => {
                    const state = onGetSettingsRowState(row.label);
                    return (
                      <button
                        type="button"
                        className={`row-pill ${state === 'active' ? 'active' : ''} ${state === 'inactive' ? 'inactive' : ''} ${state === 'mixed' ? 'mixed' : ''}`}
                        onClick={() => onToggleSettingsRow(row.label)}
                      >
                        Ряд {row.label}
                      </button>
                    );
                  })()}
                  <div className="seat-strip">
                    {row.seats.map((cell) => {
                      const inactive = !cell.active;
                      return (
                        <button
                          type="button"
                          key={`settings-${row.label}-${cell.label}`}
                          className={`seat seat-free ${inactive ? 'seat-inactive' : ''}`}
                          onClick={() => onToggleSettingsSeat(row.label, cell.label)}
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
            <div className="section-title">Билет по умолчанию</div>
            <div className="muted">Загрузи свой фон билета и задай координаты надписей для всех будущих мероприятий.</div>
            <label className="field">
              <span>Фон билета по умолчанию</span>
              <input
                id="settings-default-ticket-template"
                type="file"
                accept="image/*"
                onChange={(e) => onSettingsTemplateFileChange(e.target.files?.[0] || null)}
              />
            </label>
            <div className="muted">
              Текущий фон:{' '}
              {hallSettings.default_ticket_template_path
                ? hallSettings.default_ticket_template_path.split(/[\\/]/).pop()
                : 'не выбран'}
            </div>
            {settingsTemplatePreviewUrl ? (
              <TicketRenderedPreview imageUrl={settingsLayoutPreviewImage} layout={settingsTicketLayout} />
            ) : settingsRenderedPreviewUrl ? (
              <img className="preview-image" src={settingsRenderedPreviewUrl} alt="ticket preview" />
            ) : (
              <div className="placeholder">Превью шаблона загружается</div>
            )}
            <TicketLayoutInputs layout={settingsTicketLayout} onChange={onSettingsTicketLayoutChange} scope="settings" />
          </div>

          <div className="card-inner">
            <div className="section-title">Варианты цены по умолчанию</div>
            <div className="muted">Эти цены будут подставляться в новые мероприятия как стартовый набор.</div>
            {settingsPrices.map((price, index) => (
              <div className="price-row" key={`template-price-${index}`}>
                <input
                  value={price.label}
                  onChange={(e) => {
                    const next = [...settingsPrices];
                    next[index] = { ...price, label: e.target.value };
                    onSettingsPricesChange(next);
                  }}
                  placeholder="Тип"
                />
                <input
                  type="number"
                  value={price.amount}
                  onChange={(e) => {
                    const next = [...settingsPrices];
                    next[index] = { ...price, amount: e.target.value };
                    onSettingsPricesChange(next);
                  }}
                  placeholder="Сумма"
                />
                <button type="button" className="ghost small" onClick={() => onSettingsPricesChange(settingsPrices.filter((_, i) => i !== index))}>
                  ×
                </button>
              </div>
            ))}
            <button type="button" className="ghost wide" onClick={() => onSettingsPricesChange([...settingsPrices, { label: '', amount: '0' }])}>
              Добавить цену
            </button>
          </div>

          <button type="submit" disabled={busy}>
            Сохранить шаблон
          </button>
        </form>
      </section>
    </main>
  );
}
