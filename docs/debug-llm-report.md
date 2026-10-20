# Диагностика: `response is not JSON` на этапе 2

Дата: 2026-10-20.

## 1. Условия воспроизведения

- Workspace: `data/workspaces/demo`.
- Вход: `data/workspaces/demo/input/resume.txt`, UTF-8, 363 символа после очистки.
- Модель: `opencode/deepseek-v4.1-flash-free`.
- Сервер: `http://127.0.0.1:45278/api`.
- Промт: `config/prompts/extraction.v1.md`, версия 1.
- Схема: `extractionResponseSchema`.
- Прямой вызов выполнен временным скриптом `scripts/debug-llm.ts`, который
  повторяет `extractClaimsFromFile` и логирует сырые HTTP-ответы.

HTTP-ошибок нет: создание сессии, `POST /prompt` и `GET /message`
вернули `200`. Ошибка возникает только на разборе ответа.

## 2. Что вернул сервер

Финальное assistant-сообщение содержит `content` из двух частей:

```json
[
  { "type": "reasoning", "text": "..." },
  { "type": "text", "text": "{ ... }" }
]
```

Размеры:

- `reasoning`: 9977 символов;
- `text`: 3204 символа.

Порядок важен: часть `reasoning` идёт первой, часть `text` — второй.
Финальный `text` — валидный JSON без markdown-обёртки, начинается так:

```text
{
  "claims": [
    {
      "statement": "Работал в ООО «Ромашка» в должности руководителя отдела
продаж с октября 2019 по декабрь 2022 года.",
      "quote": "ООО Ромашка, руководитель отдела продаж\nоктябрь 2019 - декабрь 2022",
      "source_file": "resume",
      "category": "experience",
      "status": "supported",
      ...
```

Первые 1000 символов `reasoning`:

```text
The user asks to extract claims from a resume, returning only JSON. This is a task, not creative work. Skills? The instructions say invoke skills if applicable. This is a data extraction/structured output task. No skill really applies (brainstorming is for creative work; this is extraction). But let me consider: the user wants JSON only. I should not add commentary. Actually the harness instructions say prefer concise responses, but user explicitly says return only JSON.

Let me do the analysis.

Text:
- Иванов Иван Иванович, Руководитель отдела продаж
- ООО Ромашка, руководитель отдела продаж, октябрь 2019 - декабрь 2022
  - Выручка выросла на 4,2 млн руб
  - Конверсия выросла с 18% до 24%
- Компания Лютик, коммерческий директор, январь 2015 - сентябрь 2019
  - Команда 12 человек
- МГУ, экономика, 2010
- Навыки: управление командой, P&L, воронка продаж

Claims with verbatim quotes. Categories: metric/result, role, team size, education, skills.
```

Проверка `extractJson` на этих данных:

| Вход                        | Результат                                 |
| --------------------------- | ----------------------------------------- |
| `reasoning` (9977 символов) | `null`                                    |
| `text` (3204 символа)       | объект с массивом `claims` из 6 элементов |

Итог клиента после трёх попыток:

```json
{
  "ok": false,
  "error": {
    "kind": "structured-output",
    "message": "LLM structured output failed: response is not JSON"
  }
}
```

## 3. Что делает `extractJson`

Функция находится в `src/llm/structured-output.ts`.

Алгоритм:

1. Ищет markdown-блок вида ` ```json ... ``` ` или ` ``` ... ``` `
   и пытается разобрать его содержимое.
2. Если блока нет, берёт позицию первой `{` или `[` и последней `}` или `]`,
   вырезает диапазон и пытается разобрать его как JSON.
3. При любой ошибке возвращает `null`.

Что поддерживается:

- объекты `{ ... }` — да;
- массивы `[ ... ]` — да;
- markdown-обёртка ` ```json ... ``` ` — да;
- пояснение перед JSON — только если в пояснении нет посторонних скобок.
  Иначе диапазон от первой скобки до последней захватывает лишний текст,
  и `JSON.parse` падает.

В данном случае `extractJson` работает корректно: финальный `text`
разбирается без ошибок. Проблема не в нём, а в том, какой текст ему
передали.

## 4. Корневая причина

`src/llm/polling.ts`, функция `messageText`:

```typescript
for (const part of parts) {
  const text = (part as Record<string, unknown>)?.["text"];

  if (typeof text === "string" && text.length > 0) {
    return text;
  }
}
```

Функция берёт первый непустой `text` из `content`, не проверяя
`part.type`. Сервер присылает части в порядке:

1. `reasoning` — рассуждения модели;
2. `text` — финальный ответ.

Поэтому `waitForAssistant` возвращает `reasoning`, а не финальный JSON.
Более того, polling возвращается сразу, как только в `reasoning`
появился непустой текст, не дожидаясь части `text`. В результате
`extractJson` получает рассуждения, не находит в них JSON и возвращает
`null`. После трёх попыток клиент отдаёт `response is not JSON`.

Это воспроизводится на reasoning-модели `deepseek-v4.1-flash-free`.
На моделях без отдельной reasoning-части проблема может не проявляться,
поэтому юнит-тесты с mock-ответом без `reasoning` её не ловят.

## 5. Дополнительное наблюдение

Финальный JSON не соответствует `extractionResponseSchema`:

- `category` содержит `achievement_metric` и `team_size`, которых нет
  в enum (`employment`, `result`, `skill`, `tool`, `education`,
  `language`, `project`, `link`);
- `status` содержит `supported` и `self_reported`, которых нет
  в enum (`confirmed`, `needs_evidence`, `remove`);
- отсутствуют обязательные `metric_type`, `number`, `currency`.

То есть после исправления выбора части это проявится как
`schema mismatch`, а не как `response is not JSON`. Причина —
пример формата в `config/prompts/extraction.v1.md` перечисляет не все
поля и не фиксирует допустимые значения `category` и `status`.

## 6. Рекомендация

1. Исправлять `polling.messageText`, а не `extractJson` и не промт:
   - учитывать только части с `type === "text"`;
   - игнорировать `reasoning`;
   - не возвращать результат, пока в assistant-сообщении нет части
     `text` (или пока сообщение не завершено);
   - добавить тест с ответом, где `reasoning` идёт перед `text`,
     и тест на промежуточное сообщение только с `reasoning`.
2. После этого привести промт extraction в соответствие со схемой:
   перечислить `metric_type`, `number`, `currency`, допустимые
   `category` и `status`. Иначе следующий запуск упадёт на схеме.
3. Менять модель не требуется. Переход на модель без reasoning скроет
   симптом, но не исправит разбор ответа и оставит риск для других
   reasoning-моделей.

Код, промты и `structured-output.ts` в рамках диагностики не изменялись.
