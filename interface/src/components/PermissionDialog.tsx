type PermissionDialogProps = {
  open: boolean;
  busy?: boolean;
  title: string;
  description: string;
  consentLabel: string;
  consent: boolean;
  confirmClassName?: string;
  onClose: () => void;
  onConsentChange: (value: boolean) => void;
  onConfirm: () => void;
};

export function PermissionDialog({
  open,
  busy = false,
  title,
  description,
  consentLabel,
  consent,
  confirmClassName = 'danger',
  onClose,
  onConsentChange,
  onConfirm,
}: PermissionDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel confirm-panel" onClick={(event) => event.stopPropagation()}>
        <div className="panel-head">
          <div>
            <div className="eyebrow">разрешение</div>
            <h2>{title}</h2>
          </div>
          <button type="button" className="ghost" onClick={onClose}>
            Закрыть
          </button>
        </div>

        <div className="confirm-text">{description}</div>

        <label className="confirm-checkbox">
          <input type="checkbox" checked={consent} onChange={(event) => onConsentChange(event.target.checked)} />
          <span>{consentLabel}</span>
        </label>

        <div className="sale-actions">
          <button type="button" className={confirmClassName} disabled={!consent || busy} onClick={onConfirm}>
            ОК
          </button>
          <button type="button" className="ghost" onClick={onClose}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
