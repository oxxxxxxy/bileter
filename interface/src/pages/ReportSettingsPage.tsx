import type { FormEvent } from 'react';

type ReportSettingsPageProps = {
  busy: boolean;
  reportFontSize: string;
  reportPreviewUrl: string;
  onBack: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onReportFontSizeChange: (value: string) => void;
};

export function ReportSettingsPage({
  busy,
  reportFontSize,
  reportPreviewUrl,
  onBack,
  onSubmit,
  onReportFontSizeChange,
}: ReportSettingsPageProps) {
  return (
    <main className="page form-page">
      <section className="panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">сводка</div>
            <h2>Настройки сводки</h2>
          </div>
          <button type="button" className="ghost back-button" onClick={onBack}>
            Назад
          </button>
        </div>

        <form className="form-grid" onSubmit={onSubmit}>
          <div className="card-inner">
            <div className="section-title">Текст сводки</div>
            <div className="muted">Размер текста применяется к печатной сводке и её превью.</div>
            <label className="field">
              <span>Размер текста</span>
              <input type="number" min="12" value={reportFontSize} onChange={(event) => onReportFontSizeChange(event.target.value)} />
            </label>
          </div>

          <div className="card-inner">
            <div className="section-title">Превью сводки</div>
            {reportPreviewUrl ? (
              <img className="preview-image report" src={reportPreviewUrl} alt="report preview" />
            ) : (
              <div className="placeholder">Превью сводки загружается</div>
            )}
          </div>

          <button type="submit" disabled={busy}>
            Сохранить настройки сводки
          </button>
        </form>
      </section>
    </main>
  );
}
