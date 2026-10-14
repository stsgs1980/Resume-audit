# Getting started (after fork)

Чеклист после создания проекта из шаблона `webstorm-config`. Файл остаётся в репозитории
проекта вместе с конфигами.

## Step 1: Basic setup

Порядок шагов единый с `README.md` After fork.

1. Обновите `package.json`: `name`, `description`.
2. Скопируйте `README.template.md` -> `README.md`, заполните Overview, Features, Architecture.
3. Сбросьте `CHANGELOG.md` (история шаблона, не вашего проекта):

   ```bash
   rm CHANGELOG.md
   git add CHANGELOG.md
   git commit -m "chore: reset changelog for new project"
   ```

4. Настройте WebStorm — [webstorm.md](webstorm.md) (один раз).

## Step 2: Framework dependencies

`react` и `react-dom` уже в `dependencies` (шаблон React-centric). Если проект **без React**:
удалите их из `dependencies` и добавьте свой фреймворк. После удаления проверьте конфиги:
уберите `jsx: react-jsx` из `tsconfig.json` (или переключите под свой стек), отключите
React-правила в `eslint.config.js`, затем выполните `npm run lint` и `npm run typecheck`.

Выберите стек и установите (сборщики и плагины нужны только для разработки, поэтому `-D`):

```bash
# React/Vite
npm install -D vite @vitejs/plugin-react

# Vue/Vite
npm install -D vite @vitejs/plugin-vue

# Svelte/SvelteKit
npm install -D @sveltejs/kit vite

# Astro
npm install -D astro @astrojs/react

# Next.js
npm install -D @next/eslint-plugin-next eslint-plugin-testing-library
```

## Step 3: Scripts

Добавьте в `package.json` (пример для Vite):

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

## Step 4: Entry point

Для Vite создайте:

```text
index.html
src/
  main.tsx
  App.tsx
```

Тесты Vitest: `src/**/*.test.ts(x)` — см. `vitest.config.ts` и [testing.md](testing.md).

## Step 5: Verify

Полный набор как в CI (`.github/workflows/ci.yml`):

```bash
npm run lint
npm run typecheck
npm run lint:css
npm run lint:md
npm run format:check
npm test
npm run check:file-length
```

## Superpowers scratch dirs

`docs/superpowers/plans/` и `docs/superpowers/specs/` — рабочие папки агента для планов
и спеков (пустые в шаблоне, метки `.gitkeep` везут их в fork). Файлы планов коммитить
не обязательно.

## Recommended dependencies

| Project type         | Add to devDependencies                                      |
| -------------------- | ----------------------------------------------------------- |
| React/Vite           | `vite`, `@vitejs/plugin-react`                              |
| Vue/Vite             | `vite`, `@vitejs/plugin-vue`                                |
| Svelte/SvelteKit     | `@sveltejs/kit`, `vite`                                     |
| Astro                | `astro`, `@astrojs/react`                                   |
| React/Next.js        | `@next/eslint-plugin-next`, `eslint-plugin-testing-library` |
| CSS/SCSS             | `stylelint-config-standard-scss`                            |
| Tailwind CSS         | `tailwindcss` (+ см. раздел ниже)                           |
| Storybook            | `storybook`, `@storybook/react-vite`                        |
| Node.js/Backend      | `eslint-plugin-n`                                           |
| Testing (React UI)   | см. [testing.md](testing.md)                                |
| Testing (Playwright) | `@playwright/test`                                          |
| Testing (Cypress)    | `cypress`                                                   |

## Markdown правила

Markdown (`.md`) ограничен 120 символами на строку (как в `.aiassistant/rules/AI Rules.md`):

- `.editorconfig`: `[*.md] max_line_length = 120`
- `.markdownlint.json`: `MD013` (лимит 120 символов)

## Tailwind CSS v4

Линтеры в шаблоне уже настроены под Tailwind v4 — не подгоняйте Tailwind-код под линтер.

- `.stylelintrc.json` — at-правила (`@theme`, `@utility`, `@source`, `@apply`, `@layer`).
- `.prettierrc` — `prettier-plugin-tailwindcss` (уже в `devDependencies`).

Импорт в `app/globals.css` (после `npm install tailwindcss`):

```text
@import "tailwindcss";
```

Не используйте `url("tailwindcss")` — браузер не резолвит пакет, стили не применятся.

## Migrating existing projects

Приведение существующего проекта к шаблону. Выполняйте по шагам, коммитьте после каждого.

### 0. Проверьте dependencies

- Если проект **React-centric**: `react` и `react-dom` в `dependencies` — ок.
- Если проект **без React**: удалите `react`/`react-dom` из `dependencies`.
- Если проект **не React**: установите свой фреймворк (см. Step 2).

### 1. Скопируйте конфиги

Из шаблона в корень проекта:

```text
eslint.config.js
eslint-rules/
eslint-processors/
.prettierrc
.stylelintrc.json
.markdownlint.json
.editorconfig
tsconfig.base.json
vitest.config.ts
webstorm-codestyle.xml
```

### 2. Установите devDependencies

```bash
npm install -D \
  eslint @typescript-eslint/parser @eslint/markdown \
  eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-jsx-a11y eslint-plugin-jsdoc \
  prettier prettier-plugin-organize-imports prettier-plugin-tailwindcss \
  stylelint stylelint-config-standard \
  markdownlint-cli \
  husky lint-staged \
  @commitlint/cli @commitlint/config-conventional \
  conventional-changelog-cli conventional-changelog-angular \
  vitest @vitest/coverage-v8 typescript
```

Удалите дубликаты, если уже установлены (проверьте `package.json`).

### 3. Husky + lint-staged

```bash
npx husky init
```

Скопируйте хуки из шаблона:

```text
.husky/commit-msg
.husky/pre-commit
.husky/pre-push
```

### 4. WebStorm

Импортируйте `webstorm-codestyle.xml` — [webstorm.md](webstorm.md).

### 5. Скрипты

Добавьте в `package.json`:

```json
{
  "scripts": {
    "lint": "eslint . --max-warnings=0",
    "typecheck": "tsc --noEmit",
    "lint:css": "stylelint \"**/*.{css,scss}\" --allow-empty-input",
    "lint:md": "markdownlint \"**/*.md\" --ignore node_modules",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "prepare": "husky",
    "changelog": "conventional-changelog -p angular -i CHANGELOG.md -s"
  }
}
```

### 6. Verify

Полный набор как в CI (`.github/workflows/ci.yml`):

```bash
npm run lint
npm run typecheck
npm run lint:css
npm run lint:md
npm run format:check
npm test
npm run check:file-length
```

Исправьте ошибки линтеров до зелёного состояния.

## Optional later

- `eslint-plugin-vitest` — ESLint для тестовых файлов.
- `types: ["vitest/globals"]` в `tsconfig.json` — если используете `describe`/`it` без импортов
  (см. [testing.md](testing.md)).

## Добавить стек (Astro / Vue / Svelte)

Шаблон из коробки — React. Остальное добавляется по рецепту (~10 минут на стек):

| Стек   | Prettier                          | ESLint                        | Игноры        |
| ------ | --------------------------------- | ----------------------------- | ------------- |
| Astro  | `prettier-plugin-astro`           | `@astrojs/eslint-plugin` (\*) | `.astro/`     |
| Vue    | Без плагинов                      | `eslint-plugin-vue` (\*\*)    | `lint-staged` |
| Svelte | `prettier-plugin-svelte` (\*\*\*) | `flat/recommended` (\*\*\*\*) | `lint-staged` |

(\*) Подключать отдельным шагом, проверять на живых файлах.
(\*\*) Flat `recommended` + `parser: tsParser`; a11y отдельно; стили — `standard-vue`.
(\*\*\*) Без плагина Prettier падает (exit 2).
(\*\*\*\*) A11y нет вовсе — только `svelte-check`/компилятор.

Всем стекам: расширить `lint-staged` (`*.{vue,svelte,astro,scss,mts,cts}`),
`lint:css` — на `**/*.{css,scss}` + `stylelint-config-standard-scss`.
