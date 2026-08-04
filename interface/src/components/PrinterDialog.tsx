import type { ReportPrintMode } from '../types';

type PrinterDialogProps = {
  open: boolean;
  printers: string[];
  selectedPrinter: string;
  printerTicketGapMm: number;
  printerDitherEnabled: boolean;
  reportPrintMode: ReportPrintMode;
  onClose: () => void;
  onRefresh: () => void;
  onOpenSystemSettings: () => void;
  onSelectPrinter: (printer: string) => void;
  onSelectGap: (mm: number) => void;
  onSelectDither: (enabled: boolean) => void;
  onSelectReportPrintMode: (mode: ReportPrintMode) => void;
};

export function PrinterDialog({
  open,
  printers,
  selectedPrinter,
  printerTicketGapMm,
  printerDitherEnabled,
  reportPrintMode,
  onClose,
  onRefresh,
  onOpenSystemSettings,
  onSelectPrinter,
  onSelectGap,
  onSelectDither,
  onSelectReportPrintMode,
}: PrinterDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="panel-head">
          <div>
            <div className="eyebrow">принтер</div>
            <h2>Выбор принтера</h2>
          </div>
          <button type="button" className="ghost" onClick={onClose}>
            Закрыть
          </button>
        </div>

        <div className="form-grid">
          <label className="field">
            <span>Принтер для печати</span>
            <select value={selectedPrinter} onChange={(event) => onSelectPrinter(event.target.value)}>
              <option value="">Системный по умолчанию</option>
              {printers.map((printer) => (
                <option key={printer} value={printer}>
                  {printer}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Отступ между билетами, мм</span>
            <input
              type="number"
              min="0"
              step="1"
              value={printerTicketGapMm}
              onChange={(event) => onSelectGap(Number(event.target.value || 0))}
            />
          </label>

          <label className="field field-toggle">
            <span>Программный дизеринг</span>
            <div className="toggle-row">
              <input
                type="checkbox"
                checked={printerDitherEnabled}
                onChange={(event) => onSelectDither(event.target.checked)}
              />
              <strong>{printerDitherEnabled ? 'Atkinson от программы' : 'Система / драйвер'}</strong>
            </div>
          </label>

          <label className="field">
            <span>Печать сводки</span>
            <select value={reportPrintMode} onChange={(event) => onSelectReportPrintMode(event.target.value as ReportPrintMode)}>
              <option value="separate">Разными заданиями</option>
              <option value="combined">Одной картинкой</option>
            </select>
          </label>

          <div className="sale-actions">
            <button type="button" className="ghost" onClick={onRefresh}>
              Обновить список
            </button>
            <button type="button" className="ghost" onClick={onOpenSystemSettings}>
              Настройки Windows
            </button>
            <button type="button" onClick={onClose}>
              Готово
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
