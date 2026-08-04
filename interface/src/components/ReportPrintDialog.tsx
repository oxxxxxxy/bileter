import type { ReportPrintMode } from '../types';

type ReportPrintDialogProps = {
  open: boolean;
  busy?: boolean;
  eventTitle?: string;
  mode: ReportPrintMode;
  onModeChange: (mode: ReportPrintMode) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export function ReportPrintDialog({
  open,
  busy = false,
  eventTitle,
  mode,
  onModeChange,
  onClose,
  onConfirm,
}: ReportPrintDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel confirm-panel" onClick={(event) => event.stopPropagation()}>
        <div className="panel-head">
          <div>
            <div className="eyebrow">сводка</div>
            <h2>Печать сводки</h2>
          </div>
          <button type="button" className="ghost" onClick={onClose}>
            Закрыть
          </button>
        </div>

        <div className="confirm-text">
          Выбери, как печатать сводку{eventTitle ? ` для "${eventTitle}"` : ''}: одной картинкой вместе с миниатюрой билета или
          раздельно.
        </div>

        <label className="report-option">
          <input type="radio" name="report-print-mode" checked={mode === 'combined'} onChange={() => onModeChange('combined')} />
          <span>
            <strong>Одной картинкой</strong>
            <small>Миниатюра билета и текст сводки пойдут одним изображением.</small>
          </span>
        </label>

        <label className="report-option">
          <input type="radio" name="report-print-mode" checked={mode === 'separate'} onChange={() => onModeChange('separate')} />
          <span>
            <strong>Разными заданиями</strong>
            <small>Сначала миниатюра билета, потом текст сводки отдельной печатью.</small>
          </span>
        </label>

        <div className="sale-actions">
          <button type="button" disabled={busy} onClick={onConfirm}>
            Печать
          </button>
          <button type="button" className="ghost" onClick={onClose}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
