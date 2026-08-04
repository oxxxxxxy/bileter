# WebExeStarter

[![CI](https://github.com/oxxxxxxy/bileter/actions/workflows/ci.yml/badge.svg)](https://github.com/oxxxxxxy/bileter/actions/workflows/ci.yml)
[![Windows Build](https://github.com/oxxxxxxy/bileter/actions/workflows/windows-build.yml/badge.svg)](https://github.com/oxxxxxxy/bileter/actions/workflows/windows-build.yml)

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

- сборка на Windows: [README_BUILD_WINDOWS.md](README_BUILD_WINDOWS.md)
- передача готовой программы другому человеку: [README_DISTRIBUTION_WINDOWS.md](README_DISTRIBUTION_WINDOWS.md)

## Проверки и релизы

- `python -m pytest` проверяет Python-логику и требует 100% покрытия выделенного ядра.
- `cd interface && npm test` проверяет TypeScript-утилиты с порогом 100%.
- `cd interface && npm run build` проверяет типы и собирает интерфейс.
- Каждый push и pull request запускает тесты и собирает Windows `.exe` как artifact.
- Тег вида `v1.0.0` создаёт GitHub Release и прикладывает `WebExeStarter.exe`.

Готовую сборку после обычного push можно скачать на странице запущенного workflow:
`Actions` → последний `CI` → `Artifacts` → `bileter-windows-<commit>`. Внутри artifact находится готовый `WebExeStarter.exe`.

Для прямой раздачи `.exe` без исходников создай тег:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Workflow `Windows Build` создаст GitHub Release и приложит готовый `WebExeStarter.exe` отдельным файлом.
