# WebStorm setup

Одноразовая настройка IDE после `npm install`. Файлы конфигурации уже в репозитории;
WebStorm часть из них **не подхватывает автоматически**.

## Чеклист

| Шаг | Обязательно   | Действие                                      |
| --- | ------------- | --------------------------------------------- |
| 1   | Да            | Импортировать `webstorm-codestyle.xml`        |
| 2   | Да            | Включить Prettier (format on save)            |
| 3   | Да            | Включить ESLint (fix on save)                 |
| 4   | Если есть CSS | Включить Stylelint                            |
| 5   | Нет           | Vitest — подхватывается из `vitest.config.ts` |
| 6   | Нет           | EditorConfig — читается из `.editorconfig`    |
| 7   | Рекомендуется | Включить анализ кода при коммите              |

## 1. Code Style (code style)

Путь: `Settings → Editor → Code Style → шестерёнка → Import Scheme → webstorm-codestyle.xml`

Схема согласована с `.prettierrc`: двойные кавычки, trailing comma, 2 пробела,
120 символов. Для TS/JS основной форматтер — **Prettier**; code style — запасная
согласованность и языки без Prettier.

> Импорт **не выполняется сам** при `git clone` — только вручную или через
> **Share → Copy settings** у коллеги, у кого уже настроено.

## 2. Prettier

Путь: `Settings → Languages & Frameworks → JavaScript → Prettier`

- Prettier package: `{project}/node_modules/prettier`
- **Run on save** (или Actions on save → Reformat with Prettier)

Использует `.prettierrc` и плагины из `devDependencies`.

## 3. ESLint

Путь: `Settings → Languages & Frameworks → JavaScript → Code Quality Tools → ESLint`

- Mode: **Automatic**
- ESLint package: `{project}/node_modules/eslint`
- **Run eslint --fix on save**

Использует flat config `eslint.config.js`.

## 4. Stylelint

Путь: `Settings → Languages & Frameworks → Style Sheets → Stylelint`

- Enable Stylelint
- Package: `{project}/node_modules/stylelint`
- При необходимости — fix on save

Использует `.stylelintrc.json` (в т.ч. Tailwind v4 at-правила).

## 5. Vitest

После создания `src/` и файлов `*.test.ts` WebStorm показывает Run/Debug в gutter.
Конфиг: `vitest.config.ts`. Подробнее — [testing.md](testing.md).

> В шаблоне есть `tests/` (проверки тулчейна, не удалять), но нет папки `src/` — это нормально.
> `passWithNoTests: true` позволяет `npm test` проходить до Step 4 в getting-started.md.

## 6. Markdown и `.editorconfig`

`.editorconfig` устанавливает `max_line_length = 120` для `*.md` (согласно `.aiassistant/rules/AI Rules.md`).
Визуальная направляющая `SOFT_MARGINS=120` для Markdown задана в `.idea/codeStyles/Project.xml`;
жёсткий лимит держит markdownlint (`MD013` с `line_length: 120` в `.markdownlint.json`).

## 7. Конвенции стиля

- 2 пробела, точка с запятой, двойные кавычки (`USE_DOUBLE_QUOTES` в `webstorm-codestyle.xml`).
- `const`/`let` по умолчанию; `var` запрещён.
- JSDoc (`@param`, `@return`) для функций и компонентов.
- Trailing commas (`Always`) в объектах и массивах.
- Максимальная длина строки — 120 символов (`RIGHT_MARGIN` в `webstorm-codestyle.xml`).

## 8. Анализ кода при коммите (рекомендуется)

Путь: `Commit tool window (Alt+0) → Settings (⚙) → Commit Checks → Analyze code`

Включите опцию **Analyze code** и выберите профиль **Project Default**.

### Что делает

- Анализирует изменённые файлы inspection profile перед коммитом
- Показывает уведомление, если найдены ошибки/предупреждения
- Позволяет исправить проблемы перед коммитом или проигнорировать

### Альтернатива (через .idea/workspace.xml)

Если хотите зафиксировать настройку в репозитории, добавьте в `.idea/workspace.xml`:

```xml
<component name="CommitConfigs">
  <option name="ANALYZE_CODE" value="true" />
  <option name="ANALYZE_CODE_PROFILE" value="Project Default" />
  <option name="RUN_CLEANUP" value="true" />
  <option name="RUN_CLEANUP_PROFILE" value="Project Default" />
</component>
```

> **Примечание:** Это проектная настройка (в `workspace.xml`). Для каждого нового проекта
> нужно включать отдельно или использовать UI (Alt+0 → Settings).

## 9. React Buddy (превью компонентов)

Плагин установлен. Настройка при первом использовании:

1. ПКМ на файле компонента → **React Buddy** → **Add to Palette**
2. При появлении диалога **Настройка React Buddy Toolbox**:
   - **Файл package.json** — оставьте по умолчанию
   - **Директория тулбокса** — `dev/` (создаётся автоматически)
   - **Корневой компонент** — укажите `src/App.tsx` или `src/main.tsx`
3. Нажмите **OK**

### Что создаётся

- Папка `dev/` — палитра компонентов (добавлена в `.gitignore`)
- Файлы конфигурации React Buddy

### Использование

- ПКМ на компоненте → **React Buddy** → **Preview Component**
- Палитра: `View → Tool Windows → React Buddy Palette`

## 10. Что коммитится в `.idea/`

В git лежат только переносимые настройки (белый список в `.gitignore`):

- `codeStyles/` — схема Project;
- `inspectionProfiles/` — общие инспекции (профиль `Project Default`);
- `fileTemplates/`, `liveTemplates/` — шаблоны (склад для ручного импорта, см. §12);
- `watcherTasks.xml` — только вкл/выкл вотчеров (сами определения — локально, см. §11);
- `saveactions_settings.xml`, `jsonSchemas.xml`, `prettier.xml`, `vcs.xml`, `modules.xml`, `webstorm-config.iml`.

Личное (`workspace.xml`, локальные вотчеры, IDE-профили) в git не попадает.

## 11. File Watchers (ручная настройка, 5 минут)

Определения вотчеров живут в `workspace.xml` и не коммитятся, поэтому на новой машине
`Settings → Tools → File Watchers` пуст. Создайте вручную:

1. **Stylelint**: Program — `stylelint`, Arguments — `$FilePath$`, File type — CSS/SCSS.
2. **Markdownlint**: Program — `markdownlint`, Arguments — `$FilePath$`, File type — Markdown.
3. Вотчер длины файла **не создавайте**: скрипт `check-file-length.ts` проверяет
   staged-файлы, при сейве ему нечего проверять, а в pre-commit хуке он уже работает.

## 12. Live Templates (импорт)

Каталог `.idea/liveTemplates/` IDE не читает (известное ограничение, YouTrack IDEABKL-5033) —
XML-файлы там это склад. Импорт: откройте нужный XML, скопируйте тело шаблона,
`Settings → Editor → Live Templates` → `+` → вставьте.

Состав групп (React 8 шаблонов, Testing 4, TypeScript 3, Utilities 3), требования
к контексту и частые проблемы — в [docs/live-templates/README.md](live-templates/README.md).
Отдельно смотрите [шаблон компонента](live-templates/README.md): `rafce` больше не
генерирует `React.FC` и пустые Props.

## Согласованность IDE и CI

```text
Save в WebStorm  →  Prettier + ESLint + Stylelint
git commit       →  Husky + lint-staged (те же инструменты из CLI)
```

Если при коммите много неожиданных правок — проверьте шаги 2–4.

## Windows

Husky pre-commit использует `node scripts/check-file-length.ts` (кроссплатформенно).
Нужны: Node.js >= 24.15.0, Git. Pre-commit останавливается на первой ошибке.
