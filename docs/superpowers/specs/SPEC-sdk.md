# SPEC-sdk: работа с @opencode-ai/sdk

Проверено вживую против сервера opencode v2.0.28
(SDK в проекте — @opencode-ai/sdk@1.19.0).
См. также: [SPEC-pipeline.md](SPEC-pipeline.md) (LLM-слой),
[BUILD.md](../plans/BUILD.md) (Шаг 8).

## 1. Версии и расхождение

SDK 1.19.0 новее протокола сервера 2.0.28. Часть методов SDK
упирается в несуществующие роуты. Ниже зафиксировано, что
проверено вживую, а что взято из типов SDK.

Правило: при расхождении документации с исходниками авторитетнее
исходники (`node_modules/@opencode-ai/sdk/dist/`), при расхождении
типов SDK с живым сервером авторитетнее живой сервер.

`npm view @opencode-ai/sdk dist-tags` (2026-10-14): `latest: 1.19.0`
— новее стабильной версии нет, только пререлизные теги.
Апгрейд SDK невозможен, `package.json` не меняется.

## 2. Какой import использовать

```javascript
import { createOpencodeClient } from "@opencode-ai/sdk/v2";

export { createOpencodeClient };
```

Корневой `@opencode-ai/sdk` — legacy API v1: параметры в стиле
`{ path, body }`, а у `client.global` вообще нет метода `health`
(только `event`). Не использовать.

Клиент v2 отдаёт доступ через геттеры на прототипе (`get global()`,
`get session()`), поэтому `console.log(client)` показывает только
приватные поля `_global`, `_session`, `_v2`. Это нормально:
`client.global.health()` при этом работает (на новом сервере).

## 3. Подключение к запущенному серверу

Порт динамический. Узнать: `opencode service status`.

```javascript
const BASE = "http://127.0.0.1:49374/api";

export { BASE };
```

Три обязательных элемента:

1. `baseUrl` — URL сервера **с суффиксом `/api`**.
   Без суффикса API-роуты отдают HTML веб-интерфейса,
   сервер отвечает `text/html` вместо JSON.
2. Basic-авторизация: username `opencode`, пароль из файла
   `~/.config/opencode/service.json` (поле `password`).
   Без заголовка сервер отвечает
   `401 {"_tag":"UnauthorizedError"}`.
3. Кастомный `fetch`, подставляющий заголовок:

```javascript
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createOpencodeClient } from "@opencode-ai/sdk/v2";

const serverUrl = "http://127.0.0.1:49374"; // см. opencode service status
const service = JSON.parse(readFileSync(join(homedir(), ".config", "opencode", "service.json"), "utf8"));
const basic = `Basic ${Buffer.from(`opencode:${service.password}`).toString("base64")}`;

const authFetch = (url, init = {}) =>
  globalThis.fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: basic },
  });

const client = createOpencodeClient({ baseUrl: `${serverUrl}/api`, fetch: authFetch });

export { authFetch, basic, client };
```

Проверка вживую: неверный username (пустой вместо `opencode`)
даёт 401; верный — 404 на отсутствующих роутах и 200
на существующих.

## 4. Health-check

`client.global.health()` (`GET /global/health`) на сервере 2.0.28
отсутствует: SDK возвращает пустые данные без throw.
Рабочий health-check — сырой запрос:

```javascript
import { authFetch, BASE } from "./client.js";

const info = await (await authFetch(`${BASE}/info`)).json();
// { version: "2.0.28", pid: 12860, urls: [...], paths: {...}, capabilities: {...} }

export { info };
```

Критерий живости: HTTP 200 и поле `version` в ответе.
На более новом сервере (с роутом `/global/health`) использовать
`client.global.health()` и поле `data.version`.

## 5. Создание сессии

Проверено вживую через SDK:

```javascript
import { client } from "./client.js";

const created = await client.session.create({ title: "audit-run" });

export { created };
```

Параметры плоские (без обёртки `body`): `title`, `agent`,
`model: { id, providerID }`, `directory`, `parentID`.
Ответ сервера 2.0.28 обёрнут в конверт `{ data: Session }`,
поэтому id лежит на два уровня глубже, чем обещают типы SDK:

```javascript
import { created } from "./session.js";

const body = created.data?.data ?? created.data;
const sessionID = body?.id; // "ses_..."

export { sessionID };
```

## 6. Отправка промпта

`client.session.prompt({ sessionID, parts, format })` (роут
`/session/{id}/message`) на сервере 2.0.28 даёт HTTP 404:
в этой версии отправка — `POST /session/{id}/prompt`.

Рабочий вызов на 2.0.28 (сырой fetch, проверен вживую):

```javascript
import { authFetch, BASE } from "./client.js";
import { sessionID } from "./session.js";

const accepted = await (
  await authFetch(`${BASE}/session/${sessionID}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Reply with exactly: hello" }),
  })
).json();
// { data: { id: "msg_...", sessionID, type: "user", payload: { text } } }

export { accepted };
```

Вызов асинхронный: ответ подтверждает приём (`delivery: "steer"`),
текст ассистента появляется позже. Читать его:

```javascript
import { authFetch, BASE } from "./client.js";
import { sessionID } from "./session.js";

const list = await (await authFetch(`${BASE}/session/${sessionID}/message`)).json();
const messages = list?.data ?? list;

export { messages };
```

На более новом сервере (с роутом `/session/{id}/message` для POST)
использовать SDK-форму:

```javascript
import { client } from "./client.js";
import { sessionID } from "./session.js";

const reply = await client.session.prompt({
  sessionID,
  parts: [{ type: "text", text: "Hello!" }],
  model: { providerID: "opencode", modelID: "gemini-4-argon" },
});
const text = reply.data.parts.find((part) => part.type === "text")?.text;

export { text };
```

## 7. Structured output

Поле называется `format`, не `outputFormat` (в документации SDK
встречаются оба; в типах `v2/gen/types.gen.d.ts` — только `format`):

```javascript
import { client } from "./client.js";
import { sessionID } from "./session.js";

const result = await client.session.prompt({
  sessionID,
  parts: [{ type: "text", text: "Return a greeting for Ada" }],
  format: {
    type: "json_schema",
    schema: {
      type: "object",
      properties: { greeting: { type: "string" } },
      required: ["greeting"],
    },
    retryCount: 2,
  },
});

export { result };
```

Чтение результата (имена из типов SDK, не из документации):

```javascript
import { result } from "./structured.js";

const output = result.data.info.structured; // unknown, валидный JSON по схеме
const failure = result.data.info.error; // см. раздел 8

export { failure, output };
```

В документации встречается `info.structured_output` — это имя
из API v1, в v2 поле называется `structured`.

Долг частично закрыт (2026-10-14). Установлено по живому серверу:
402 был специфичен модели `opencode/gemini-4-argon` (нет средств
на Console-аккаунте), а не всего аккаунта: бесплатная
`opencode/space-bunny-free` ответила `{"type":"text","text":"hello"}`
end-to-end. Но поля `format` нет в схеме тела prompt 2.0.28
(проверено по `/openapi.json`: только `text`, `files`, `agents`,
`skills`, `metadata`, `delivery`, `resume`), поэтому structured
output через API 2.0.28 недоступен в принципе. См. разделы 12 и 14:
до появления нового сервера используется парсинг текста + Zod.

## 8. Обработка ошибок

1. По умолчанию `throwOnError: false`: HTTP-ошибки НЕ бросают
   исключение, а возвращаются в поле `error`:
   `const { data, error } = await client.session.create({...})`.
1. Транспортные ошибки (нет соединения, таймаут) бросают
   исключение — ловить через `try/catch`.
1. Ошибка модели лежит в `info.error` и типизирована юнионом:
   `ProviderAuthError | UnknownError | MessageOutputLengthError |
MessageAbortedError | StructuredOutputError |
ContextOverflowError | ContentFilterError | ApiError`.
1. Неудавшийся structured output после всех ретраев:

```javascript
const handleStructuredError = (info) => {
  if (info.error?.name === "StructuredOutputError") {
    return {
      message: info.error.data.message,
      retries: info.error.data.retries,
    };
  }

  return null;
};

export { handleStructuredError };
```

1. Живой кейс: при исчерпанной квоте провайдера сообщение
   ассистента содержит `error: { type: "provider.quota",
message: "Upstream request failed: Insufficient account funds",
status: 402 }`. Экспорт при такой ошибке запрещён:
   это неразрешённое расхождение (fail-closed).

## 9. Что это значит для Шага 8

`src/llm/client.ts` строит клиент по разделу 3 (baseUrl с `/api`,
auth-fetch, пароль из `service.json`) и делает health-check
по разделу 4. `src/llm/session.ts` создаёт сессии по разделу 5
с развёрткой конверта `{ data }`. `src/llm/structured-output.ts`
реализует раздел 12 (парсинг текста + Zod, а не поле `format`
из раздела 7 — оно заработает только на новом сервере).
Все вызовы учитывают конверт `{ data }` сервера 2.0.28, пока
минимальная поддерживаемая версия сервера не зафиксирована иначе.

## 10. Совместимость версий

1. SDK 1.19.0 — последний стабильный (`latest` в npm).
   Сгенерирован под более новый протокол, чем сервер 2.0.28:
   `global.health`, `POST /session/{id}/message`, поле `format`,
   `info.structured` — на 2.0.28 отсутствуют (проверено по живому
   `/openapi.json`, всего 118 роутов).
1. Базовый URL для 2.0.28: `<server>/api`. Без суффикса —
   HTML веб-интерфейса вместо JSON.
1. Ответы сервера 2.0.28 обёрнуты в конверт `{ data: ... }`,
   типы SDK его не описывают: разворачивать вручную
   (`body?.data ?? body`).

## 11. Что работает через SDK, что через сырой fetch

| Вызов          | SDK 1.19.0                 | Сырой fetch              | Статус на 2.0.28      |
| -------------- | -------------------------- | ------------------------ | --------------------- |
| Health         | `global.health()`          | `GET /api/info`          | Только fetch ([OK])   |
| Session create | `create({title})` + анврап | `POST /api/session`      | SDK ([OK])            |
| Session прочие | `session.*`                | `GET /api/session...`    | SDK (проверен create) |
| Промпт         | `prompt()` → 404           | `POST .../prompt {text}` | Только fetch ([OK])   |
| Сообщения      | `messages()`               | `GET .../message`        | Fetch ([OK])          |
| Structured     | `format` → 404             | Поля нет в API           | Нет (см. раздел 12)   |

## 12. Structured output: статус и альтернативы

1. Статус: недоступен ни через SDK, ни напрямую — в схеме тела
   prompt 2.0.28 нет поля `format` (только `text`, `files`,
   `agents`, `skills`, `metadata`, `delivery`, `resume`).
1. Альтернатива для Шага 8: текстовый ответ → извлечь JSON
   (голый JSON или из кодового блока) → `Zod.safeParse` →
   при неуспехе ретрай с уточняющим промптом (лимит 2, по аналогии
   с `retryCount`). Непарсинг после ретраев — локальный
   `StructuredOutputError { message, retries }` той же формы,
   что в типах SDK.
1. Живые проверки без квоты: подмена транспорта (fake `fetch`
   в тестах, контракт по разделу 11); ручные прогоны — только
   на бесплатных моделях (`opencode/space-bunny-free` и другие
   `*-free` из `GET /api/model`).

## 13. Авторизация

1. Схема: HTTP Basic. Username по умолчанию `opencode`
   (переопределяется `OPENCODE_SERVER_USERNAME`), пароль —
   `OPENCODE_SERVER_PASSWORD` или поле `password` из
   `~/.config/opencode/service.json`. Пустой username даёт 401.
1. Передача — через кастомный `fetch` из раздела 3: других точек
   входа для заголовка в конфиге SDK-клиента нет.
1. Пароли и ключи (`service.json`, `auth.json`) — секреты:
   не печатать в логи, не коммитить, в SPEC только пути к файлам.

## 14. Решение для Шага 8

1. `src/llm/client.ts`: import из `@opencode-ai/sdk/v2`, baseUrl
   с `/api`, auth-fetch, health-check через `/api/info`,
   хелпер развёртки конверта `{ data }`.
1. `src/llm/session.ts`: создание сессий через SDK
   (`session.create`), модель по умолчанию — бесплатная
   (`opencode/space-bunny-free`), с возможностью переопределить.
1. `src/llm/structured-output.ts`: отправка сырым fetch
   (`POST .../prompt { text }`), ожидание ответа через polling
   `GET .../message`, извлечение JSON + Zod + ретрай (лимит 2).
1. `src/llm/checkpoint.ts`: без изменений относительно плана.
1. Тесты: mock транспорта (fake `fetch` с зафиксированными
   ответами сервера 2.0.28); живые вызовы — вне CI.
1. Триггер пересмотра: сервер с роутами `/global/health` и
   `format` в prompt — перейти на `session.prompt()` + `format`
   из раздела 7 и убрать анврап конверта.
