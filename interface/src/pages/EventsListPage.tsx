import type { EventItem } from '../types';

type EventsListPageProps = {
  events: EventItem[];
  busy: boolean;
  reloadToken: number;
  onOpenCreate: () => void;
  onOpenSale: (eventId: number) => void;
  onOpenEdit: (eventId: number) => void;
  onPrintReport: (eventId: number, eventTitle?: string) => void;
  onResetEvent: (eventId: number, eventTitle?: string) => void;
};

export function EventsListPage({
  events,
  busy,
  reloadToken,
  onOpenCreate,
  onOpenSale,
  onOpenEdit,
  onPrintReport,
  onResetEvent,
}: EventsListPageProps) {
  return (
    <main className="page grid-list">
      {events.length === 0 ? (
        <div className="empty-state">
          <h2>Пока нет мероприятий</h2>
          <p>Нажми «+» ниже, чтобы создать первое мероприятие.</p>
        </div>
      ) : (
        events.map((event) => (
          <article className="event-card" key={event.id}>
            <button type="button" className="event-image-button" onClick={() => onOpenSale(event.id)}>
              <img src={`/api/events/${event.id}/image?v=${reloadToken}`} alt={event.title} />
            </button>
            <div className="event-meta">
              <div className="event-actions">
                <button type="button" className="ghost" onClick={() => onOpenEdit(event.id)}>
                  Редактировать
                </button>
                <button type="button" onClick={() => onOpenSale(event.id)}>
                  Продажа
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => onPrintReport(event.id, event.title || 'Без названия')}
                  disabled={busy}
                >
                  Сводка
                </button>
                <button
                  type="button"
                  className="danger small"
                  onClick={() => onResetEvent(event.id, event.title || 'Без названия')}
                  disabled={busy}
                >
                  Сброс
                </button>
              </div>
            </div>
          </article>
        ))
      )}

      <button type="button" className="create-fab" onClick={onOpenCreate}>
        +
      </button>
    </main>
  );
}
