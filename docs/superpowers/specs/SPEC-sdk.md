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

Долг, не финал: вживую не проверено. На сервере 2.0.28 в теле
prompt нет поля `format`, а провайдер вернул 402
`Insufficient account funds`, поэтому ответ ассистента получить
не удалось. Шаг 8 обязан перепроверить этот раздел первым делом
на доступном сервере с квотой.

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
реализует раздел 7 и обязан сначала перепроверить его вживую.
Все вызовы учитывают конверт `{ data }` сервера 2.0.28, пока
минимальная поддерживаемая версия сервера не зафиксирована иначе.
