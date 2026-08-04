# Сборка на Windows

## Что должно быть установлено

- `Python 3.11` или `3.12`
- `Node.js 20 LTS`
- `npm`

Проверь:

```powershell
python --version
npm --version
```

## Как собрать

Из корня проекта запусти:

```powershell
.\build_windows.ps1
```

Если PowerShell блокирует скрипты:

```powershell
powershell -ExecutionPolicy Bypass -File .\build_windows.ps1
```

## Что делает скрипт

1. создаёт `.venv-build-win`
2. ставит Python-зависимости
3. собирает frontend
4. собирает `dist\WebExeStarter.exe`

## Результат

Готовый файл:

```text
dist\WebExeStarter.exe
```

## Где хранятся данные после запуска

Основной режим:

- `db\app.sqlite3`
- `db\templates\`
- `logs\launcher.log`

Если рядом с `exe` нет прав на запись, приложение использует fallback:

- `%LOCALAPPDATA%\WebExeStarter\`

## Диагностика

Если `exe` не запускается или пишет, что сервер не поднялся:

1. открой лог:

```text
logs\launcher.log
```

или fallback:

```text
%LOCALAPPDATA%\WebExeStarter\logs\launcher.log
```

2. пришли лог целиком
