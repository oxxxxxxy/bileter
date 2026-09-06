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

Или с явным указанием имени и архитектуры (x86 или x64):

```powershell
.\build_windows.ps1 -Name "WebExeStarter-x86" -Arch "x86"
```

Если PowerShell блокирует скрипты:

```powershell
powershell -ExecutionPolicy Bypass -File .\build_windows.ps1 -Name "WebExeStarter-x86" -Arch "x86"
```

> **Важно про разрядность (x86 vs x64):**
> - Для компьютеров со старой или 32-битной Windows (например, кассовые терминалы x86) сборку нужно выполнять в 32-битном Python (`win32` / `x86`). Полученный 32-битный `.exe` будет запускаться как на 32-битной, так и на 64-битной Windows (через WOW64).
> - В GitHub Actions настроена автоматическая матричная сборка: собираются параллельно `WebExeStarter-x86.exe` (32-бит) и `WebExeStarter-x64.exe` (64-бит).

## Что делает скрипт

1. определяет архитектуру активного Python (`32-bit` / `64-bit`)
2. создаёт изолированное окружение `.venv-build-win-x86` или `.venv-build-win-x64`
3. ставит Python-зависимости (`pip`, `requirements`, `pyinstaller`)
4. собирает frontend (`interface/dist`)
5. собирает `dist\<Name>.exe`

## Результат

Готовые файлы в папке `dist\`:

```text
dist\WebExeStarter-x86.exe  (для 32-битной и 64-битной Windows)
dist\WebExeStarter-x64.exe  (только для 64-битной Windows)
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
