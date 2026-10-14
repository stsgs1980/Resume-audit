# Testing with Vitest

Шаблон включает Vitest с `environment: "node"` — этого достаточно для юнит-тестов
чистых функций и Node-логики. Менять конфиг **не нужно**, пока вы не начнёте
тестировать React-компоненты или код с DOM (`document`, `window`, `localStorage`).

## Где чьи тесты

- `tests/**` — проверки тулчейна самого шаблона (например `unicode-policy`), не удалять при fork.
- `src/**` — тесты вашего проекта, создаются по Step 4 в [getting-started.md](getting-started.md).

## Скрипты

| Команда                 | Описание                      |
| ----------------------- | ----------------------------- |
| `npm test`              | Запуск тестов (один прогон)   |
| `npm run test:watch`    | Тесты в watch-режиме          |
| `npm run test:coverage` | Тесты с отчётом покрытия (v8) |

## Когда менять конфиг

| Сценарий                                    | `environment`          | Доп. пакеты                          |
| ------------------------------------------- | ---------------------- | ------------------------------------ |
| Утилиты, парсеры, API-хелперы               | `node` (как сейчас)    | —                                    |
| React-компоненты, хуки с DOM                | `jsdom`                | Testing Library + `jsdom` (см. ниже) |
| Полные пользовательские сценарии в браузере | Vitest не заменяет e2e | `@playwright/test` или `cypress`     |

## Как переключить Vitest на React/DOM-тесты

**1. Установите зависимости:**

```bash
npm install -D jsdom @testing-library/react @testing-library/jest-dom \
  @testing-library/user-event
```

**2. Обновите `vitest.config.ts`:**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    passWithNoTests: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});
```

**3. Создайте `src/test/setup.ts`:**

```typescript
import "@testing-library/jest-dom/vitest";
```

**4. (Опционально) Добавьте типы Vitest в `tsconfig.json`**, если используете
`describe` / `it` / `expect` без импортов:

```json
{
  "compilerOptions": {
    "types": ["vitest/globals"]
  }
}
```

**5. Пример теста компонента (`src/Button.test.tsx`):**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Submit</Button>);

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(onClick).toHaveBeenCalledOnce();
  });
});
```

## Уровни тестирования (не путать)

- **Vitest + `node`** — юнит-тесты без UI (уже в шаблоне).
- **Vitest + `jsdom` + Testing Library** — компоненты и интеграция в изолированном DOM.
- **Playwright / Cypress** — e2e в реальном браузере; дополняют Vitest, а не заменяют его.
