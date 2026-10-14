# ${PROJECT_NAME}

[![CI](https://github.com/${GITHUB_USER}/${PROJECT_NAME}/actions/workflows/ci.yml/badge.svg)](https://github.com/${GITHUB_USER}/${PROJECT_NAME}/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescript.org/)
[![ESLint](https://img.shields.io/badge/ESLint-9.x-4B32C3.svg)](https://eslint.org/)
[![Prettier](https://img.shields.io/badge/Prettier-3.x-F7B93E.svg)](https://prettier.io/)
[![Stylelint](https://img.shields.io/badge/Stylelint-17.x-263227.svg)](https://stylelint.io/)

> **Status**: ACTIVE
> **Last Updated**: ${DATE}

## Overview

Краткое описание проекта, его цели и решаемые задачи.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Scripts](#scripts)
- [Docs](#docs)
- [Architecture](#architecture)
- [Contributing](#contributing)
- [License](#license)

## Features

- Функция 1
- Функция 2

## Tech Stack

Заполните под ваш проект после [getting-started](docs/getting-started.md) (Steps 2–4).

- **Language**: TypeScript
- **Framework**: _например React + Vite_
- **Linting**: ESLint, Stylelint, markdownlint, Prettier (из шаблона)
- **Testing**: Vitest
- **Hooks**: Husky, lint-staged, Commitlint

## Getting Started

### Prerequisites

- Node.js >= 24.15.0 (обязателен для `node scripts/check-file-length.ts` в pre-commit)

Pre-commit останавливается на первой ошибке: сначала `lint-staged`, затем проверка длины файлов.

### Installation

```bash
git clone <repository-url>
cd <project-directory>
npm install
```

### CHANGELOG.md (важно для шаблона)

При клонировании шаблона `CHANGELOG.md` содержит историю **webstorm-config**, а не вашего проекта.

```bash
rm CHANGELOG.md
git add CHANGELOG.md
git commit -m "chore: reset changelog for new project"
```

Pre-push hook генерирует CHANGELOG.md только на ветке main (на других ветках молча пропускается)
на основе conventional commits вашего проекта.

Первый запуск в новом проекте из шаблона — [docs/getting-started.md](docs/getting-started.md)
(фреймворк, `src/`, скрипты `dev`/`build`).

IDE: [docs/webstorm.md](docs/webstorm.md) (импорт code style, on save, анализ при коммите, React Buddy — **вручную**).

## Scripts

| Команда                 | Описание                                  |
| ----------------------- | ----------------------------------------- |
| `npm run lint`          | ESLint                                    |
| `npm run typecheck`     | TypeScript (`tsc --noEmit`)               |
| `npm run lint:css`      | Stylelint                                 |
| `npm run lint:md`       | markdownlint                              |
| `npm run format`        | Prettier (запись)                         |
| `npm run format:check`  | Prettier (проверка, как в CI)             |
| `npm test`              | Vitest                                    |
| `npm run test:watch`    | Vitest (watch)                            |
| `npm run test:coverage` | Vitest + coverage                         |
| `npm run dev`           | _добавьте после Step 3 в getting-started_ |

## Docs

| Документ                                      | О чём                                 |
| --------------------------------------------- | ------------------------------------- |
| [getting-started.md](docs/getting-started.md) | Фреймворк, `src/`, Tailwind, проверка |
| [webstorm.md](docs/webstorm.md)               | Настройка WebStorm                    |
| [testing.md](docs/testing.md)                 | Vitest, `jsdom`, Testing Library      |
| [markdown.md](docs/markdown.md)               | Правила оформления `.md`              |

## Architecture

Опишите архитектуру (например FSD):

- `app/` — маршрутизация
- `features/` — бизнес-логика, хуки
- `shared/` — утилиты и UI

## Contributing

1. `git checkout -b feat/your-feature`
2. `git commit -m "feat: add your feature"`
3. `git push origin feat/your-feature`

## Conventions

Стиль кода: 2 пробела, точка с запятой, двойные кавычки, trailing commas,
JSDoc (`@param`, `@return`), `const`/`let`. См. `.aiassistant/rules/AI Rules.md`.

## License

MIT
