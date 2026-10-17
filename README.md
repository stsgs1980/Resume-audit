# Resume Audit

[![CI](https://github.com/stsgs1980/resume-audit/actions/workflows/ci.yml/badge.svg)](https://github.com/stsgs1980/resume-audit/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescript.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D24.15.0-brightgreen.svg)](https://nodejs.org/)
[![ESLint](https://img.shields.io/badge/ESLint-9.x-4B32C3.svg)](https://eslint.org/)
[![Vitest](https://img.shields.io/badge/Vitest-5.x-6E9F18.svg)](https://vitest.dev/)

> **Status**: ACTIVE
> **Last Updated**: 2026-10-14

## Overview

**Resume Audit** — локальное веб-приложение для строгого аудита резюме кандидата
под поиск работы на hh.ru.

Приложение решает главную проблему LLM-генерации резюме — **галлюцинации** —
архитектурно, а не промптом «не выдумывай». Источник правды (`facts.json`)
отделён от генерации, все числа проверяются кодом, экспорт заблокирован
до полной согласованности.

Работает на `127.0.0.1`, использует локальный opencode server как LLM-провайдер.
Данные не покидают машину, кроме вызовов модели.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Статус разработки](#статус-разработки)
- [Scripts](#scripts)
- [Docs](#docs)
- [Architecture](#architecture)
- [Contributing](#contributing)
- [Conventions](#conventions)
- [Limitations](#limitations)
- [License](#license)

## Features

- **8 этапов конвейера**: файлы → утверждения → аудит → вопросы → роли → ATS →
  генерация → верификация. Готовы все этапы [OK]; роли и ATS (этапы 5–6)
  реализованы в составе `stage3b`.
- **Источник правды**: `facts.json` содержит только подтверждённые факты.
  Стаж, доли и производные — вычисляются.
- **Человек в цикле**: этап 4 — очередь вопросов с карточками `evidence`,
  без которых факт не становится подтверждённым.
- **Детерминированное ядро**: даты, стаж, нормализация чисел, блок-листы,
  ATS, верификация — чистый TypeScript, без LLM.
- **Двухслойная верификация**: слой 1 (код) проверяет все числа, роли,
  оговорки, запрещённые слова; слой 2 (LLM) перечисляет числа своего текста
  для сверки.
- **Per-role allowlist**: каждый факт привязан к целевым ролям. Число
  из Sales Operations не проходит в версию AI Product Owner.
- **По-документная инвалидация**: `facts_hash` хранится отдельно для каждой
  версии резюме. Перегенерация версии 2 не гасит версии 1 и 3.
- **Fail-closed экспорт**: экспорт заблокирован при stale-документе,
  неразрешённых расхождениях, неверной сумме долей или отсутствии
  обязательного поля hh.ru.
- **Двусторонняя трассируемость**: клик по числу в резюме открывает запись
  в `facts.json` и цитату в исходном файле — и наоборот.
- **Три целевые роли**: sales / salesops / aipo. Каждая — отдельная версия
  резюме с собственным системным промтом.
- **Два режима интерфейса**: Обзор (дашборд) и Ревью (резюме + рекомендации).

### Чего приложение не делает

- Не обращается к hh.ru и не скрейпит сайт. Только локальные файлы.
- Не знает и не моделирует закрытые алгоритмы ранжирования hh.ru.
- Не выдумывает факты. Утверждение без подтверждения получает статус,
  а не попадает в резюме.
- Не проверяет факты через работодателей. Находит внутренние противоречия
  и требует карточек доказательств.
- Не публикует резюме без прохождения верификации.

## Tech Stack

- **Language**: TypeScript 5.9 (strict, ESM)
- **Runtime**: Node.js >= 24.15.0
- **Server**: Fastify (schema-driven API, `app.inject()` для тестов)
- **UI**: Vite + React 19, `shadcn/ui` (Base UI) + `TanStack Table`
- **Schemas**: Zod — единый контракт для API, LLM structured output,
  `facts.json`
- **LLM**: opencode server через `@opencode-ai/sdk`
- **Testing**: Vitest 5 + coverage-v8
- **Linting**: ESLint 9 (с границами между слоями), Stylelint, markdownlint,
  Prettier
- **Hooks**: Husky, lint-staged, Commitlint

## Getting Started

### Prerequisites

- Node.js >= 24.15.0
- npm >= 11.0.0
- [opencode](https://opencode.ai) >= 2.0.28 — установлен и доступен
  как `opencode`
- WebStorm 2026.2+ (опционально, для интеграции через ACP)

### Installation

```bash
git clone <repository-url>
cd resume-audit
npm install
```

### Запуск opencode server

В отдельном терминале:

```bash
opencode serve
```

Сервис поднимется на динамическом порту (см. `opencode service status`).
Приложение подключается к нему через `@opencode-ai/sdk`.

### Запуск приложения

```bash
npm run dev
```

Открыть `http://localhost:4174`.

## Статус разработки

Проект в активной разработке. Закрыты Фазы 0–4:
спецификация, ядро, схемы, данные и все 8 этапов конвейера.

| Фаза               | Статус |
| ------------------ | ------ |
| 0. Спецификация    | [OK]   |
| 1. Ядро            | [OK]   |
| 2. Схемы данных    | [OK]   |
| 3. LLM-слой        | [OK]   |
| 4. Этапы конвейера | [OK]   |
| 5. UI              | [TODO] |
| 6. Приёмка         | [TODO] |

Фаза 4 в разбивке:

- Этап 1 (файлы) — [OK]
- Этап 2 (claims) — [OK]
- Этап 3 (аудит) — [OK]
- Этап 4 (факты, человек в цикле) — [OK]
- Этап 5 (роли) — [OK] (в составе `stage3b`)
- Этап 6 (ATS) — [OK] (в составе `stage3b`)
- Этап 7 (генерация) — [OK]
- Этап 8 (верификация) — [OK]

Что должно быть построено — [SPEC.md](docs/superpowers/specs/SPEC.md).
Как строить по шагам — [BUILD.md](docs/superpowers/plans/BUILD.md).

## Scripts

| Команда                     | Описание                              |
| --------------------------- | ------------------------------------- |
| `npm run dev`               | Vite dev-server + Fastify (порт 4174) |
| `npm run build`             | Сборка UI + компиляция сервера        |
| `npm start`                 | Запуск собранного приложения          |
| `npm run lint`              | ESLint                                |
| `npm run typecheck`         | TypeScript (`tsc --noEmit`)           |
| `npm run lint:css`          | Stylelint                             |
| `npm run lint:md`           | markdownlint                          |
| `npm run format`            | Prettier (запись)                     |
| `npm run format:check`      | Prettier (проверка, как в CI)         |
| `npm test`                  | Vitest (494 теста)                    |
| `npm run test:watch`        | Vitest (watch)                        |
| `npm run test:coverage`     | Vitest + coverage                     |
| `npm run check:file-length` | Проверка длины файлов (лимит 250)     |

## Docs

| Документ                                                           | О чём                                         |
| ------------------------------------------------------------------ | --------------------------------------------- |
| [SPEC.md](docs/superpowers/specs/SPEC.md)                          | Спецификация системы: схемы, конвенции, этапы |
| [BUILD.md](docs/superpowers/plans/BUILD.md)                        | План сборки: порядок, гейты, тесты            |
| [webstorm.md](docs/webstorm.md)                                    | Настройка WebStorm, ACP, opencode             |
| [testing.md](docs/testing.md)                                      | Vitest, `jsdom`, Testing Library              |
| [markdown.md](docs/markdown.md)                                    | Правила оформления `.md`                      |
| [AGENTS.md](AGENTS.md)                                             | Конвенции проекта для opencode                |
| [.aiassistant/rules/AI Rules.md](.aiassistant/rules/AI%20Rules.md) | Конвенции для JetBrains AI Assistant          |

## Architecture

Трёхслойная архитектура. Код в одном проекте, границы между слоями
проверяются ESLint (`no-restricted-imports`).

### Слои

| Слой     | Папка          | Может импортировать                        | Не может                         |
| -------- | -------------- | ------------------------------------------ | -------------------------------- |
| Ядро     | `src/core`     | только `src/core`                          | `schemas`, `llm`, `server`, `ui` |
| Схемы    | `src/schemas`  | только `src/schemas`                       | `core`, `llm`, `server`, `ui`    |
| LLM      | `src/llm`      | `core`, `schemas`                          | `server`, `ui`                   |
| Сервер   | `src/server`   | `core`, `schemas`, `llm`                   | `ui`                             |
| Pipeline | `src/pipeline` | `core`, `schemas`, `llm`, `server/storage` | `ui`                             |
| UI       | `src/ui`       | `schemas`, HTTP API                        | `core`, `llm`                    |

### Детали

- **`src/core`** — детерминированное ядро. Чистый TypeScript, ноль
  зависимостей от Node, HTTP, LLM. Тестируется в изоляции.
- **`src/schemas`** — Zod-схемы. Контракт для `facts.json`, `claims.json`,
  `audit.json`, `validation.json`, structured output LLM, API.
- **`src/llm`** — обёртка над opencode SDK. Session, structured output,
  чекпоинты, retry.
- **`src/server`** — Fastify. Роуты, статика, файловое хранилище.
- **`src/ui`** — React. Только типы из `schemas` и HTTP-запросы к серверу.

### Структура

```text
src/
  core/
    dates.ts             ← включительный подсчёт, полуоткрытые интервалы
    experience.ts        ← наивная сумма + объединение интервалов
    interval-analysis.ts ← разрывы и пересечения
    numbers.ts           ← нормализация, валюта из контекста
    number-check.ts      ← кросс-проверка чисел
    skills.ts            ← per-role блок-листы
    detectors.ts         ← плейсхолдеры, маркеры, прогнозные
    format.ts            ← форматирование стажа
    verification.ts      ← слой 1 верификации
  schemas/
    facts.ts, evidence.ts, claims.ts, audit.ts
    validation.ts, stage-state.ts, files.ts, index.ts
  llm/
    client.ts, session.ts, structured-output.ts, checkpoint.ts
    prompts.ts, prompt-registry.ts, logger.ts, auth.ts
    polling.ts, schemas.ts, types.ts, index.ts
  pipeline/
    stage1/              ← файлы: чтение, классификация
    stage2/              ← claims: чанкинг, извлечение через LLM
    stage3/              ← аудит: противоречия, вопросы, роли, ATS
    stage4/              ← факты: очередь вопросов, человек в цикле
    stage7/              ← генерация
    stage8/              ← верификация
  server/
    storage/             ← paths, files, hash, lock, stage-state,
                           workspaces, errors, index
  ui/
    App.tsx
    main.tsx
```

### Данные

```text
data/
  facts.json          ← источник правды
  evidence/<id>.json  ← карточки доказательств
  audit.json          ← производное: противоречия, вопросы, роли, ATS
  claims.json         ← этап 2: утверждения с цитатами
  files.json          ← этап 1: инвентарь и классификация
  validation.json     ← этап 8: верификация
  stage-state.json    ← статусы + facts_hash каждого документа
  resumes/*.json      ← сгенерированные версии
  logs/model-responses.log  ← с ротацией, без содержимого резюме
```

### Переход на монорепо (когда наступит триггер)

Границы слоёв уже соблюдаются. Переход к `packages/core` + `apps/web`
сводится к переносу папок и замене импортов `./core` → `@resume-audit/core`.

Триггеры для перехода:

1. Появился CLI, которому нужен `core` без `ui`.
2. Появился второй потребитель ядра (бот, API, публичная библиотека).
3. Команда выросла до 2+ разработчиков.
4. Понадобилось версионировать `core` отдельно.
5. Билд стал медленным из-за пересборки при правке UI.

## Contributing

1. `git checkout -b feat/your-feature`
2. `git commit -m "feat: add your feature"`
3. `git push origin feat/your-feature`

## Conventions

Стиль кода: 2 пробела, точка с запятой, двойные кавычки, trailing commas,
JSDoc (`@param`, `@return`), `const`/`let`. См. `.aiassistant/rules/AI Rules.md`.

Ключевые конвенции проекта (см. [AGENTS.md](AGENTS.md)):

- **Даты**: включительный подсчёт месяцев. `present` = последний завершённый
  месяц относительно `audit_date`.
- **Слияние интервалов**: полуоткрытые интервалы `[s, e+1)`. Смежность
  (`prev.end == next.start`) — нормальная последовательность, не пересечение.
- **Стаж**: считается двумя способами. Наивная сумма (конвенция hh.ru) —
  в резюме, объединение интервалов (истина) — в отчёте.
- **Числа**: все в резюме должны быть подмножеством `facts.json` для целевой
  роли по полю `roles`.
- **Утверждение без цитаты** — удаляется кодом.
- **`facts.json`** — источник правды. Производные (`audit.json`,
  `validation.json`) не хранятся в нём.
- **Верификация**: слой 1 (код) не может быть обойдён слоем 2 (LLM).
- **Экспорт** — fail-closed.
- **Файлы**: лимит 250 строк (проверяется `check:file-length` в pre-commit).

## Limitations

1. Приложение **не знает** алгоритмов ранжирования hh.ru и не делает вид,
   что знает.
2. Качество текстовых оценок зависит от модели. Вся арифметика и проверки —
   в коде. На подключении более сильной модели вырастет только качество
   оценок, не расчёты.
3. **Конфиденциальность.** Резюме — персональные данные. Тексты утверждений
   и черновики резюме передаются в opencode server и далее в провайдера
   модели. Журнал `data/logs/model-responses.log` хранит только метаданные
   вызовов (длины, время, статусы), без самих текстов. Каталог `data/`
   в `.gitignore`.
4. Тексты вакансий не обязательны. Без них ключевые слова строятся
   на гипотезе и помечаются в отчёте.
5. Приложение не проверяет факты через работодателей и не может этого делать.
6. Ни одно сгенерированное резюме не публикуется без верификации
   и заполненных карточек доказательств.
7. Транзитивная уязвимость в `braces` (dev-only, stylelint) —
   см. [SECURITY.md](SECURITY.md#known-limitations).

## License

MIT
