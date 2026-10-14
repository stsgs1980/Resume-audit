# AGENTS.md

Конвенции проекта Resume Audit для opencode и других AI-агентов.
Дополняет `.aiassistant/rules/AI Rules.md` (для JetBrains AI Assistant).

## 1. Language & Communication

- Always respond in Russian.
- Code, commands, and file names stay in English.
- Never use emoji or Unicode box/line drawing characters in responses or code.
  Use text tags like [OK], [FAIL], [TODO], [WARNING], [INFO] instead.

## 2. Rule Zero: Answer Before Act

Before any action, classify the user's request:

- Question: answer in text, do NOT create or modify files.
- Task: execute it.
- Unclear: ask for clarification.
- Confirmation ("yes", "go ahead", "continue"): execute the agreed plan.

## 3. Code Style & Formatting

- TypeScript strict mode. Explicit typing for all parameters and return values
  (no `any`).
- Semicolons are required. Double quotes. Trailing commas. 2 spaces indent.
- Max line length 120. Max file length 250 lines.
- JSDoc with `@param` and `@returns` for every function, method, React component.
- Markdown: follow `docs/markdown.md`. Code blocks must specify a language
  (`text`, `typescript`, `tsx`). JSX in fenced blocks must use `tsx`.

## 4. Anti-Monolith (Auto-Activation)

This skill MUST activate automatically when ANY of these conditions is detected:

- File exceeds 250 lines (TS/JS) or component exceeds 200 lines.
- 3+ `useState` in one component (extract to custom hook).
- Function exceeds 50 lines.

When a threshold is crossed:

1. STOP writing the monolith.
2. Announce: `[ANTI-MONOLITH] Threshold exceeded: <reason>`
3. Apply decomposition: extract subcomponents, extract hooks, separate data fetching.
4. Continue the task with decomposed modules.

## 5. Clean Code & Architecture

- Never hardcode absolute paths in code (use env vars).
- Always read a file before editing it.

### Layered architecture (resume-audit)

Код в одном проекте. Границы между слоями соблюдаются жёстко.

| Слой   | Папка         | Может импортировать      | Не может                         |
| ------ | ------------- | ------------------------ | -------------------------------- |
| Ядро   | `src/core`    | только `src/core`        | `schemas`, `llm`, `server`, `ui` |
| Схемы  | `src/schemas` | только `src/schemas`     | `core`, `llm`, `server`, `ui`    |
| LLM    | `src/llm`     | `core`, `schemas`        | `server`, `ui`                   |
| Сервер | `src/server`  | `core`, `schemas`, `llm` | `ui`                             |
| UI     | `src/ui`      | `schemas`, HTTP API      | `core`, `llm`                    |

- `src/core` — чистый TypeScript. Ноль зависимостей от Node, HTTP, LLM.
- `src/schemas` — Zod. Единый контракт для API, LLM, `facts.json`.
- `src/llm` — обёртка над opencode SDK.
- `src/server` — Fastify.
- `src/ui` — React, только HTTP к серверу.

## 6. Resume Audit Conventions

### Даты

- Включительный подсчёт месяцев: `(end.year - start.year) * 12
  - (end.month - start.month) + 1`.
- `present` = последний завершённый месяц относительно `audit_date`.
- Слияние интервалов — полуоткрытые `[s, e+1)`. Смежность
  (`prev.end == next.start`) — не пересечение.
- Разрыв строго больше 3 месяцев — предупреждение. Ровно 3 — не флаг.

### Стаж

- Считается **двумя способами**:
  - наивная сумма (конвенция hh.ru) — идёт в резюме;
  - объединение интервалов (истина) — идёт в отчёт.
- На тестовом наборе: 262 мес (наивная) против 261 мес (истина).
  Разница — двойной учёт стыка 2005-07.

### Числа

- Валюта извлекается из контекста строки. Если её нет — `null`, а не USD.
- Все числа в сгенерированном резюме обязаны быть подмножеством `facts.json`
  для целевой роли по полю `roles`.
- Числа-исключения (не требуют сверки): годы в датах, телефоны, номера
  в списках, номера версий.

### Факты

- `facts.json` — источник правды. Только: jobs, education, languages,
  confirmed_skills, portfolio_projects.
- Стаж, доли ролей, производные — вычисляются. Не хранятся.
- `audit.json`, `claims.json`, `validation.json`, `stage-state.json` —
  производные, не лежат в `facts.json`.
- Утверждение без цитаты удаляется кодом.
- `needs_evidence` без заполненной карточки evidence блокирует экспорт.

### Верификация

- Слой 1 (код) — детерминирован, не может быть обойдён слоем 2 (LLM).
- Слой 2 — дополнение, не замена.
- `hedge_required: true` требует нейтрально-делового маркера атрибуции
  в том же абзаце. Анти-паттерны оправданий запрещены.
- Экспорт — fail-closed: stale, расхождения, неверная сумма долей,
  отсутствие обязательного поля hh.ru.

## 7. Git & Commits

- Conventional Commits: `type(scope): short description`.
- Allowed types: feat, fix, docs, style, refactor, test, chore, perf, ci, build.
- Do not commit directly to main without verification.
- Pre-commit (Husky + lint-staged) must pass.
- Pre-push generates CHANGELOG.md only on main. If changed, commit first.

## 8. Work Cycle

- Read, Plan, Execute, Record, Commit.
- Debugging: reproduce locally, identify root cause (not symptoms),
  write a failing test before the fix.
- Do not skip pre-commit checks.

## 9. Privacy

- Резюме — персональные данные.
- `data/logs/model-responses.log` не коммитится.
- Тексты уходят в opencode server и далее в провайдера модели.

## 10. Documentation Sync

SPEC в `docs/superpowers/specs/` — это отражение того, что делает код.
Если SPEC и код расходятся, коммит считается сломанным.

### Принцип

Любое изменение поведения системы должно сопровождаться обновлением
SPEC в том же коммите.

Что считается изменением поведения:

- новая функция, модуль, файл в `src/`
- изменение формы данных (схемы, конфиги, структура папок)
- изменение логики (правило, порог, порядок шагов)
- удаление чего-либо

Что НЕ требует обновления SPEC:

- рефакторинг без изменения поведения
- форматирование
- тесты без изменения контракта
- исправление опечаток в комментариях

### Проверка перед коммитом

Задай себе вопрос: если бы новый разработчик прочитал только SPEC,
понял бы он это изменение? Если нет — обнови SPEC.

### Какой SPEC обновлять

Не по карте файлов, а по смыслу изменения:

- форма данных (схемы, конфиги) → `SPEC-facts.md`
- даты, стаж, числа, навыки, детекторы → `SPEC-dates.md`,
  `SPEC-pipeline.md`
- верификация, fail-closed → `SPEC-verification.md`
- UI, экспорт → `SPEC-ui.md`
- расширяемость, версионирование → `SPEC-meta.md`
- новая фаза, шаг, тест → `BUILD.md`
- статус проекта, число тестов → `README.md`

Если сомневаешься — обнови тот SPEC, где ближе всего по смыслу.
