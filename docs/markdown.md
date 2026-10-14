# Markdown conventions

Правила для `*.md` в этом репозитории. Проверка: `npm run lint:md` (markdownlint в CI и pre-commit).

## Длина строки

- Максимум **120 символов** на строку (как в `.prettierrc` и `webstorm-codestyle.xml`).
- Относится к **прозе и таблицам**, не к содержимому fenced code blocks.
- Длинный абзац — разбить на несколько строк.
- Длинную команду в `bash` — переносить через `\`:

```bash
npm install -D jsdom @testing-library/react @testing-library/jest-dom \
  @testing-library/user-event
```

## Fenced code blocks

- Язык обязателен (см. также AI Rules): ` ```typescript`, ` ```bash`, не пустой fence.
- **JSX** — только ` ```tsx`, не ` ```typescript`. Иначе WebStorm
  парсит `<Component />` как оператор сравнения и показывает `> expected`.
- Имя языка должно соответствовать содержимому: `json`, `css`, `text` для деревьев каталогов.

## Таблицы

- Колонки **выровнять по `|`** (стиль aligned tables).
- Длинные списки в ячейке не растягивать: сократить текст или дать ссылку на раздел ниже.
- После правок: `npm run lint:md`.

Пример выравнивания:

```markdown
| Команда    | Описание                    |
| ---------- | --------------------------- |
| `npm test` | Запуск тестов (один прогон) |
```

## Чеклист перед коммитом

1. `npm run lint:md`
2. В WebStorm: нет ошибок в Problems для изменённых `.md`
3. JSX-примеры в `tsx`, строки prose ≤ 120 символов
4. Нет emoji или Unicode graphics (ESLint `unicode-policy`)

## Символы

- Используйте ASCII: `->` вместо `→`, `...` вместо `…`
- Emoji запрещены: используйте текстовые теги `[OK]`, `[FAIL]`, `[TODO]`
- CHANGELOG.md — автогенерированный, содержит `<!-- markdownlint-disable -->` в начале
