# WebExeStarter

Приложение для продажи билетов:

- `server` - FastAPI backend
- `interface` - React + TypeScript frontend
- `db` - SQLite данные и шаблоны билетов

Основной сценарий:

1. приложение поднимает локальный сервер;
2. открывает интерфейс в браузере на `http://127.0.0.1:8000`;
3. кассир создаёт мероприятия, продаёт, резервирует и отменяет билеты;
4. печать идёт на системный принтер.

## Важно

Для собранного Windows `exe` данные теперь portable:

- база данных хранится рядом с программой в `db\app.sqlite3`
- шаблоны билетов хранятся рядом с программой в `db\templates\`
- логи launcher'а по возможности тоже хранятся рядом с программой в `logs\launcher.log`

Если папка с `exe` недоступна для записи, приложение автоматически уходит в fallback:

- `%LOCALAPPDATA%\WebExeStarter\`

## Документация

- сборка на Windows: [`README_BUILD_WINDOWS.md`](/home/pyot/RiderProjects/WebExeStarter/README_BUILD_WINDOWS.md)
- передача готовой программы другому человеку: [`README_DISTRIBUTION_WINDOWS.md`](/home/pyot/RiderProjects/WebExeStarter/README_DISTRIBUTION_WINDOWS.md)
