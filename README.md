# webstorm-config

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/stsgs1980/webstorm-config/actions/workflows/ci.yml/badge.svg)](https://github.com/stsgs1980/webstorm-config/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D24.15.0-brightgreen.svg)](https://nodejs.org/)
[![WebStorm](https://img.shields.io/badge/WebStorm-2026.2-orange.svg)](https://www.jetbrains.com/webstorm/)

Репозиторий-**шаблон** настроек для WebStorm: ESLint, Prettier, Stylelint, Vitest, Husky, AI rules.

## Этот README vs README.template.md

| Файл                        | Назначение                                                      |
| --------------------------- | --------------------------------------------------------------- |
| **README.md** (этот файл)   | Документация репозитория `webstorm-config` на GitHub            |
| **README.template.md**      | Копируется в **ваш** проект как `README.md` после fork (Step 1) |
| **docs/getting-started.md** | Шаги после fork — остаётся в проекте, не переписывается         |

## Что есть в шаблоне (и чего нет)

> **Шаблон настроек, не приложение:** нет `src/`, нет `npm run dev` до Steps 2–4 в
> [docs/getting-started.md](docs/getting-started.md).

| Есть сразу после `npm install`  | Нет до настройки проекта |
| ------------------------------- | ------------------------ |
| Линтеры, Prettier, Husky        | `src/`, UI-код           |
| Vitest (`passWithNoTests`)      | `npm run dev` / сборщик  |
| `react` в deps (для ESLint/TSX) | Vite / Next (Step 2)     |

`react` и `react-dom` в `dependencies` — **для линтинга и TypeScript (JSX)**, не для запуска
приложения. Сборщик добавляете на Step 2. Проект без React: удалите их и поправьте
`tsconfig.json` (`jsx`) и `eslint.config.js` (React-правила) — детали в Step 2
[getting-started](docs/getting-started.md).

## Quick Start (создать проект из шаблона)

После любого Option выполните обязательные шаги из [After fork](#after-fork-кратко).

### Option 1: GitHub Template (recommended)

```bash
gh repo create my-project --template stsgs1980/webstorm-config --clone
cd my-project
npm install
```

### Option 2: `degit` (no git history)

```bash
npx degit stsgs1980/webstorm-config my-project
cd my-project
npm install
```

### Option 3: Manual clone

```bash
git clone https://github.com/stsgs1980/webstorm-config my-project
cd my-project
rm -rf .git
git init
npm install
```

### Package managers

| Manager | Install        | Lock file           |
| ------- | -------------- | ------------------- |
| npm     | `npm install`  | `package-lock.json` |
| pnpm    | `pnpm install` | `pnpm-lock.yaml`    |
| Bun     | `bun install`  | `bun.lockb`         |

## What's Included

| Tool             | Config                                       |
| ---------------- | -------------------------------------------- |
| **ESLint**       | `eslint.config.js` — TS/JS/JSX, React, a11y  |
| **Stylelint**    | `.stylelintrc.json` — Tailwind v4 at-rules   |
| **Prettier**     | `.prettierrc`, `.prettierignore`             |
| **markdownlint** | `.markdownlint.json`                         |
| **TypeScript**   | `tsconfig.json` (strict)                     |
| **Git hooks**    | Husky + lint-staged                          |
| **Commitlint**   | Conventional Commits                         |
| **EditorConfig** | `.editorconfig`                              |
| **WebStorm**     | `webstorm-codestyle.xml`, `.idea/` templates |
| **AI Rules**     | `.aiassistant/rules/AI Rules.md`             |
| **Testing**      | Vitest — `vitest.config.ts`                  |

**Docs (едут в fork):** [getting-started](docs/getting-started.md),
[WebStorm](docs/webstorm.md), [testing](docs/testing.md), [markdown](docs/markdown.md),
[live templates](docs/live-templates/README.md).

## After fork (кратко)

1. Обновите `package.json`: `name`, `description`.
2. `README.template.md` -> `README.md`, заполнить Overview / Features / Architecture.
3. Удалить `CHANGELOG.md` (история шаблона, не вашего проекта):

   ```bash
   rm CHANGELOG.md && git add CHANGELOG.md && git commit -m "chore: reset changelog for new project"
   ```

4. WebStorm — [docs/webstorm.md](docs/webstorm.md).
5. Фреймворк, `src/`, скрипты — [docs/getting-started.md](docs/getting-started.md) (Steps 2–5).

## Conventions

См. `.aiassistant/rules/AI Rules.md`: JSDoc, strict TS, 120 chars, Conventional Commits,
anti-monolith (250 lines).

## License

MIT
