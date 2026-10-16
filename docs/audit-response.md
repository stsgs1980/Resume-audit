# Ответ на внешний аудит

Дата: 2026-10-16
Прогон: 5d4534d
Всего пунктов: 50
CONFIRMED: 39
REFUTED: 2
PARTIAL: 9

Метод: каждый пункт проверен чтением указанного файла
(путь:строка + фрагмент), где возможно - воспроизведением
через `npx tsx -e` или grep. Код не изменялся.

## Сводка

Топ-5 по критичности (чинить первым):

1. П.17 - `stage4/index.ts` пишет `facts.json` при `schema_mismatch`.
   Прямое нарушение fail-closed: невалидные данные сохраняются.
2. П.1 - lock-файл: `stage4/lock.ts` пишет объект `{ state }`,
   а `server/storage/lock.ts` читает голую строку. Round-trip рвётся.
3. П.2 - `evidence_id` (`resN`) не сходится с именем файла
   карточки (`claimN.json`). Связка факты-доказательства разорвана.
4. П.4 + П.13 - всем результатам присваиваются все роли,
   а `hedge_required` всегда `false`. Проверки слоя 1
   на реальных данных конвейера никогда не срабатывают.
5. П.6/7/8 - сверка чисел игнорирует currency/unit/qualifier
   и использует `.find()` вместо `.filter()`: USD неотличим от RUB,
   "45 человек" от "45 %", число верной роли блокируется тенью.

Что оказалось преувеличением:

- П.12 (REFUTED) - `layer1.ts` корректно передаёт
  `forbidden.global`, mismatch нет.
- П.36 (REFUTED) - `SECURITY.md` вообще не описывает
  персональные данные (36 строк, разделы только про уязвимости).
- П.9 (PARTIAL) - 5 из 7 функций `verify*` из ядра
  в `stage8` вызываются; не используются только обёртки
  `verifyHedge`/`verifyForbidden` и ядерный `verifyNumbers`.
- П.20 (PARTIAL) - `readJson` покрывает не только stage-state,
  но и `facts.lock`.
- П.3 (PARTIAL) - `hashFacts` вызывается из stage7/stage8,
  пустые хеши только в `audit.json`.
- П.16 (PARTIAL) - regex на типичных входах с заглавной
  даёт верную компанию или усечение до "ООО", не "unknown".
- П.24 (PARTIAL) - в `checkpoint.ts` не дословная копия,
  а упрощённая реализация без Windows-retry; путь из аудита неверен.
- П.44 (PARTIAL) - среда Node v24.21.0 удовлетворяет engines,
  подтверждено лишь отсутствие enforcement.
- П.50 (PARTIAL) - тест 22 (path traversal) реализован
  в `paths.test.ts`; отсутствует только тест 21 (XSS).

## Детальный отчёт

### Группа 1. Блокеры и баги конвейера

## Пункт 1. Lock-файл: два несовместимых формата

**Вердикт:** CONFIRMED
**Файл:** `src/pipeline/stage4/lock.ts:87`, `src/server/storage/lock.ts:12,42,59`
**Доказательство:** запись
`await writeJsonAtomic(lockPath, { state: "locked", lockedAt: ... })`
против чтения через `lockStateSchema = z.enum(["draft", "locked"])`.
Round-trip: объект -> `readLockState` THROWS
`Invalid lock state in workspace "ws1"`; голая строка
`"locked"` -> `readLockState` возвращает `locked`.
**Комментарий:** Файл от `tryLock` не читается через
`readLockState`, форматы несовместимы.

## Пункт 2. evidence_id vs claim_id

**Вердикт:** CONFIRMED
**Файл:** `src/pipeline/stage4/build-jobs.ts:157,176`,
`src/pipeline/stage4/evidence-writer.ts:24,27`
**Доказательство:** `evidence_id: id`, где `id = 'res${counter}'`,
против `const factId = question.relatedClaimIds[0] ?? question.id`
(вид `claimN`) и записи в `${factId}.json`.
Репродукция: `evidence_id=res1`, файлы `["claim13.json"]`,
совпадение `false`.
**Комментарий:** Результат ссылается на `resN`, а карточка
лежит в `claimN.json`; связка разорвана.

## Пункт 3. facts_hash: "" в audit.json

**Вердикт:** PARTIAL
**Файл:** `src/pipeline/stage3/index.ts:87-88,137-138`
**Доказательство:** `facts_hash: "", meta_hash: ""` в `runStage3a`
и `runStage3`. Grep `hashFacts|hashMeta` по `src/pipeline/`:
только `stage8/index.ts:6,128` и `stage7/generate-one.ts:5,51`;
`hashMeta` в конвейере не вызывается вообще.
**Комментарий:** Пустые хеши в `audit.json` верны, но `hashFacts`
в конвейере вызывается (stage7/stage8), просто не для audit.

## Пункт 4. roles: [...all] в build-jobs.ts

**Вердикт:** CONFIRMED
**Файл:** `src/pipeline/stage4/build-jobs.ts:175` (и `:49`)
**Доказательство:** `roles: [...roles]` внутри `buildResults`,
где параметр - все целевые роли; плюс `void roles` в `buildJobs`.
Репродукция: вход `['sales','tech']` -> результат
`roles=["sales","tech"]`.
**Комментарий:** Каждому результату присваиваются все роли
без фильтрации, per-role allowlist не работает.

## Пункт 5. markDocumentStale / invalidateAllDocuments не вызываются

**Вердикт:** CONFIRMED
**Файл:** `src/server/storage/stage-state.ts:57,89`
**Доказательство:** Определения на строках 57 и 89; grep
по `src/pipeline/` - ноль совпадений; по всему `src/` -
только определения, реэкспорт и тесты.
**Комментарий:** Функции мертвы для всего продакшн-кода,
единственный caller - тесты.

### Группа 2. Дыры верификации (слой 1)

## Пункт 6. factsNumbers без currency

**Вердикт:** CONFIRMED
**Файл:** `src/core/verification.ts:24,134`
**Доказательство:** Тип
`factsNumbers: Array<{ factId: string; value: number; roles: string[] }>`,
сравнение `entry.value === parsed.value`.
Репродукция: `4,2 млн USD` и `4,2 млн руб` оба дают
`found: true` при факте 4200000.
**Комментарий:** `parseNumber` валюту различает, но `verifyNumbers`
её отбрасывает; USD и RUB неразличимы.

## Пункт 7. Не проверяются unit и qualifier

**Вердикт:** CONFIRMED
**Файл:** `src/core/verification.ts:24,127-134`
**Доказательство:** Полей `unit`/`qualifier` в `factsNumbers` нет.
Репродукция: `45 человек` (`qualifier: exact`) и `45 %`
(`qualifier: percent`) оба дают `found: true, factId: res1`
при факте 45.
**Комментарий:** Квалификатор вычисляется, но при сверке
игнорируется.

## Пункт 8. factsNumbers.find вместо filter

**Вердикт:** CONFIRMED
**Файл:** `src/pipeline/stage8/layer1-numbers.ts:72`
(тот же паттерн в `src/core/verification.ts:134`)
**Доказательство:** `factsNumbers.find((entry) => entry.value === parsed.value)`,
проверка роли только у найденного.
Репродукция: факты `[{resA,45,[salesops]}, {resB,45,[sales]}]`,
`roleId = sales` -> ошибка `число не для роли "sales"`
с `factId: resA`, подходящий `resB` проигнорирован.
**Комментарий:** Первый совпавший по значению факт затеняет
остальные, число верной роли ошибочно блокируется.

## Пункт 9. verify* не вызываются из stage8

**Вердикт:** PARTIAL
**Файл:** `src/pipeline/stage8/layer1-numbers.ts:2,63,89`,
`src/pipeline/stage8/layer1.ts:4,161,166,207,213`
**Доказательство:** Вызываются: `verify` (ядро), `extractNumbers`,
`verifySkills`, `verifyRequiredFields`, `verifyShareSum`.
Не вызываются: ядерный `verifyNumbers` (в stage8 свой
одноимённый враппер), `verifyHedge` и `verifyForbidden`
(hedge переписан инлайн, `detectForbiddenWords` напрямую).
**Комментарий:** Одеяло "ничего не вызывается" ложно -
вызывается 5 из 7; верна лишь часть про три обёртки.

## Пункт 10. Детекторы не вызываются вне layer1

**Вердикт:** CONFIRMED
**Файл:** `src/pipeline/stage8/layer1.ts:208`
**Доказательство:** Grep детекторов по `src/pipeline` даёт
единственный вызов - `detectPlaceholders` в layer1;
`detectForecastMarkers` и `detectCausalityWithoutSource` -
ноль вызовов. stage1/stage3 дублируют логику инлайн
(`classify.ts:57-71`, `question-generator.ts:72-89`).
**Комментарий:** Функции-детекторы вне layer1 де-факто
мёртвый код; вместо переиспользования - дубли.

## Пункт 11. config/causality.json не читается нигде

**Вердикт:** CONFIRMED
**Файл:** `config/causality.json`
**Доказательство:** Grep `causality` по `src/`: только импорт
в `detectors.test.ts:2` и комментарии в `detectors.ts:76-81`.
Ни один production-модуль файл не открывает.
**Комментарий:** Файл существует, но единственный
потребитель - unit-тест детектора.

## Пункт 12. forbidden-words: { global } против string[]

**Вердикт:** REFUTED
**Файл:** `src/pipeline/stage8/layer1.ts:159,207`
**Доказательство:** `readConfig<{ global?: string[] }>(...)` и
`detectForbiddenWords(fullText, forbidden.global ?? [])` -
передаётся именно массив `string[]`, сигнатура
`detectForbiddenWords(text: string, words: string[])` соблюдена.
**Комментарий:** Распаковка `.global` с fallback выполнена
корректно, mismatch нет.

## Пункт 13. hedge_required: false всегда

**Вердикт:** CONFIRMED
**Файл:** `src/pipeline/stage4/build-jobs.ts:177`
**Доказательство:** Grep `hedge_required\s*[:=]` по `src/`:
единственное production-присваивание - `hedge_required: false`;
остальное - чтения и тестовые фикстуры.
**Комментарий:** Путь потребления доказан рабочим тестом,
но продюсер `true` никогда не ставит - механизм
в реальном pipeline не срабатывает.

### Группа 3. Эвристики этапа 4

## Пункт 14. Голый год -> выдуманный месяц 01

**Вердикт:** CONFIRMED
**Файл:** `src/pipeline/stage4/parse-dates.ts:52,81`
**Доказательство:** `YEAR_PATTERN = /\b((?:19|20)\d{2})\b/`,
`matchAll(...).map((match) => '${match[1]}-01')`.
Вывод: `extractDateRange("Привлёк 2000 клиентов")` ->
`{"start":"2000-01","end":"2000-01","isCurrent":false}`.
**Комментарий:** Число клиентов трактуется как год
с выдуманным месяцем; ожидание аудита совпало полностью.

## Пункт 15. date_mismatch по общим словам 4+ букв

**Вердикт:** CONFIRMED
**Файл:** `src/pipeline/stage3/date-check.ts:61-63,79`
**Доказательство:** `companyWords` - слова 4+ букв;
`shared = ...some((word) => ...includes(word))`.
Репродукция: Альфа (2020-2021) vs Бета (2022-2023) с общим
`"работал руководителем отдела продаж"` ->
`date_mismatch` для разных компаний.
**Комментарий:** Общие слова дают `shared=true` и ложный
`date_mismatch` для разных мест работы.

## Пункт 16. Company regex сваливает в unknown

**Вердикт:** PARTIAL
**Файл:** `src/pipeline/stage4/build-jobs.ts:5,58`
**Доказательство:** `COMPANY_PATTERN = /в\s+(?:компании\s+)?([А-ЯЁA-Z][^\s.,;:!?()]*)/u`,
fallback `?? "unknown"`. Прогон: `"в Ромашке"` -> `"Ромашке"`,
`"в ООО Ромашка"` -> `"ООО"`, `"в компании Ромашка"` ->
`"Ромашка"`, `"в ромашке"` -> `null`.
**Комментарий:** На типичных входах с заглавной `unknown`
нет - либо верно, либо усечение до "ООО"; `unknown` только
при строчной букве или отсутствии совпадения.

## Пункт 17. Запись facts.json при schema_mismatch

**Вердикт:** CONFIRMED
**Файл:** `src/pipeline/stage4/index.ts:101-111`
**Доказательство:** `const validated = factsSchema.safeParse(facts);
if (!validated.success) { warnings.push({code:"schema_mismatch"...}); }
try { await writeJsonAtomic(params.factsPath, facts); }` -
запись безусловная, пишется исходный невалидный `facts`,
ветки отказа нет.
**Комментарий:** Нарушение fail-closed: невалидные данные
сохраняются, лишь с предупреждением.

## Пункт 18. Подстрока без обработки отрицания

**Вердикт:** CONFIRMED
**Файл:** `src/pipeline/stage4/apply-answer.ts:78,95,113-115`
**Доказательство:** `freeText.includes("целев")` ->
`setStatus("remove")` для `target_vs_measured`;
`"это не целевая метрика".includes("целев")` -> `true`,
ветка `remove`. Рядом `includes("удалить")` для `contradiction`.
**Комментарий:** Отрицание `не` не проверяется, фраза
"не целевая" уходит в `remove`.

### Группа 4. Контракты

## Пункт 19. Схемы claims/audit/validation только в тестах

**Вердикт:** CONFIRMED
**Файл:** `src/schemas/schemas.test.ts:2`
**Доказательство:** Grep схем по `src/`: только определения,
реэкспорт (`schemas/index.ts`) и `schemas.test.ts`;
по `scripts/` - ноль. Production импортирует только
`facts`/`evidence`/`stage-state`/`llm/schemas`.
**Комментарий:** Схемы определены, но ни один
production-модуль ими не валидирует.

## Пункт 20. JSON.parse as Facts, readJson только для stage-state

**Вердикт:** PARTIAL
**Файл:** `src/pipeline/stage8/index.ts:110`
**Доказательство:** `as Facts|as Claim` - 19 вхождений
(10 production, 9 тесты). `readJson` вызывается в 3 местах:
`stage-state.ts:25`, `review.ts:135` (обе stage-state) и
`lock.ts:33` для `facts.lock`.
**Комментарий:** Первая половина верна - Facts/Claims читаются
без валидации. Вторая неточна: `readJson` покрывает
и `facts.lock`.

## Пункт 21. Расхождение Claim.metric_type

**Вердикт:** CONFIRMED
**Файл:** `src/schemas/claims.ts:13`, `src/pipeline/stage2/types.ts:14-35`
**Доказательство:** Схема:
`metric_type: z.string().nullable().optional()` (и `number`,
`currency`, `reason` опциональны); stage2:
`metric_type: string; number: number | null; ...` - всё обязательное.
**Комментарий:** Один концепт Claim имеет две несовместимые
формы: опциональные поля против обязательных.

## Пункт 22. process.cwd() в classify и question-generator

**Вердикт:** CONFIRMED
**Файл:** `src/pipeline/stage1/classify.ts:34`,
`src/pipeline/stage3/question-generator.ts:12`
**Доказательство:** `readFileSync(join(process.cwd(), "config", ...))`,
обёрнуто в try/catch с `return []`.
**Комментарий:** При запуске из другой директории падения нет -
catch молча возвращает пустые маркеры, т.е. fail-open
деградация, а не падение.

## Пункт 23. DEFAULT_PARTIAL_DIR против workspaces

**Вердикт:** CONFIRMED
**Файл:** `src/pipeline/stage2/index.ts:17,37,58,66`,
`src/server/storage/paths.ts:30,75-78`
**Доказательство:** `DEFAULT_PARTIAL_DIR = "data/partial"`,
используется при `params.partialDir ?? DEFAULT_PARTIAL_DIR`;
остальной код - корень `RESUME_AUDIT_DATA_DIR ?? "data"` +
`workspaces/<slug>`. `params.partialDir` никто не передаёт.
**Комментарий:** Дефолт partial - cwd-относительный, вне изоляции
workspace и вне StorageConfig.

### Группа 5. Дубли и мёртвый код

## Пункт 24. Копия writeJsonAtomic в checkpoint.ts

**Вердикт:** PARTIAL
**Файл:** `src/llm/checkpoint.ts:9,14`
(файла `src/server/storage/checkpoint.ts` не существует)
**Доказательство:** `writeJsonAtomicLocal` повторяет каркас
(tmp + mkdir + write + rename), но без retry-ветки
`isWindowsBusyFile` из `files.ts:35-46`. Файл честно помечен
комментарием про долг.
**Комментарий:** Дубль есть, но это упрощённая реализация,
а не дословная копия; путь из аудита неверен.

## Пункт 25. computeExperience дублирует unionLength

**Вердикт:** CONFIRMED
**Файл:** `src/core/experience.ts:8,97-137`
**Доказательство:** Импорт только `monthsInclusive, toMonths`;
слияние интервалов написано вручную (сортировка +
`interval.start <= currentEnd`), как в `unionLength`
(`dates.ts:137-171`); `unionLength`/`naiveSum` не вызываются.
**Комментарий:** Алгоритм объединения продублирован инлайн
вместо `unionLength(toHalfOpen(...))`.

## Пункт 26. Свой detectCurrency в apply-answer.ts

**Вердикт:** CONFIRMED
**Файл:** `src/pipeline/stage4/apply-answer.ts:7-8,38-48,101`
**Доказательство:** Локальный `detectCurrency` - `includes`
точных кодов RUB/USD/EUR; импорта из `core/numbers` нет.
Канонический (`numbers.ts:45`) ловит также ₽/$/руб/долл/евро
через earliest-match.
**Комментарий:** Своя упрощённая реализация с уже семантикой
вместо импорта.

## Пункт 27. Двойной loadRoleConfig в stage4/index.ts

**Вердикт:** CONFIRMED
**Файл:** `src/pipeline/stage4/index.ts:5,66,70`
**Доказательство:** Строка 66 загружает конфиг, строка 70
в ветке `claims.length === 0` загружает тот же файл повторно
вместо переиспользования переменной.
**Комментарий:** Избыточный повторный I/O-вызов на пустом пути.

## Пункт 28. Функции стажа не используются вне core

**Вердикт:** CONFIRMED
**Файл:** `src/pipeline/stage3/date-check.ts:1-4`
**Доказательство:** Grep `computeExperience|naiveSum|unionLength|formatExperience`
по `src`: совпадения только в `src/core/` и их тестах;
вне core - ноль. Единственный импорт из core - даты
и интервалы в `date-check.ts`.
**Комментарий:** Все четыре функции - мёртвый код для pipeline:
вызываются только тестами.

## Пункт 29. Покрытие test:coverage

**Вердикт:** CONFIRMED
**Файл:** `package.json:84`
**Доказательство:** `vitest run --coverage`, 24.5s, 63 файла,
410 тестов - всё зелёное. Сводка v8: Statements 90.47%,
Branches 77.95%, Functions 96.15%, Lines 90.34%.
Худший branch: `server/storage/files.ts` 37.5%,
`stage4/question-queue.ts` 50%, `stage8/index.ts` 50%,
`stage7/load-profile.ts` 50%, `stage7/build-defense.ts` 54.16%.
**Комментарий:** Команда существует и отрабатывает; слабее всего
branch у files.ts (Windows-ветки) и stage-индексов.

### Группа 6. Документация

## Пункт 30. Число тестов в README

**Вердикт:** CONFIRMED
**Файл:** `README.md:158`
**Доказательство:** Дока: "Vitest (319 тестов)"; факт:
`npx vitest run` -> `Tests 410 passed (410)`.
Число 319 повторено в `BUILD.md:85,198`.
**Комментарий:** README устарел: фактических тестов 410.

## Пункт 31. Фаза 3 LLM-слой [TODO]

**Вердикт:** CONFIRMED
**Файл:** `README.md:137`
**Доказательство:** Дока: `| 3. LLM-слой | [TODO] |`; факт:
`src/llm/` - 12 файлов реализации
(client, session, structured-output, checkpoint, schemas,
prompts, prompt-registry, polling, auth, logger и др.).
**Комментарий:** Фаза 3 реализована, а README маркирует её TODO.

## Пункт 32. Фаза 4 этапы 4-8 [TODO]

**Вердикт:** PARTIAL
**Файл:** `README.md:42-43,138`
**Доказательство:** Дока: этапы 4-8 `[TODO]`; факт:
есть stage1-4, stage7, stage8; нет stage5 и stage6.
**Комментарий:** Этапы 4, 7, 8 реализованы вопреки TODO,
а 5-6 действительно отсутствуют.

## Пункт 33. Пути из README не существуют

**Вердикт:** CONFIRMED
**Файл:** `README.md:210,226-232`
**Доказательство:** `src/core/ats.ts`, `src/server/index.ts`,
`src/server/routes/`, `src/ui/components/`, `src/ui/pages/` -
все 5 проверок glob: "No files found". Реально в `server/`
только `storage/`, в `ui/` только `App.tsx` и `main.tsx`.
**Комментарий:** Ни один из пяти путей не существует.

## Пункт 34. pipeline нет в таблице слоёв README

**Вердикт:** CONFIRMED
**Файл:** `README.md:182-188`
**Доказательство:** Таблица содержит только Ядро, Схемы, LLM,
Сервер, UI; строки про pipeline нет. В `AGENTS.md:62`
строка есть.
**Комментарий:** Таблица README неполна относительно AGENTS.md.

## Пункт 35. Шаги 8 и 9 BUILD.md

**Вердикт:** PARTIAL
**Файл:** `docs/superpowers/plans/BUILD.md:116-129`
**Доказательство:** Шаги 8 и 9 - все 9 чекбоксов `[ ]`;
факт: файлы шага 8 существуют, 6 промтов шага 9
в `config/prompts/` существуют, но `config/schemas/` нет.
**Комментарий:** Шаг 8 реализован полностью вопреки `[ ]`,
шаг 9 - частично (схемы в `src/llm/schemas.ts`).

## Пункт 36. SECURITY.md про персональные данные

**Вердикт:** REFUTED
**Файл:** `SECURITY.md:1-36`
**Доказательство:** Весь файл - 36 строк про версии
и сообщения об уязвимостях; grep
`персональ|конфиденц|резюме|limitations` - ноль совпадений.
Приватность резюме описана только в `README.md:299-302`.
**Комментарий:** SECURITY.md персональные данные не описывает.

## Пункт 37. Якорь SECURITY.md#known-limitations

**Вердикт:** CONFIRMED
**Файл:** `README.md:309`, `SECURITY.md`
**Доказательство:** Ссылка `[SECURITY.md](SECURITY.md#known-limitations)`;
в SECURITY.md такого заголовка нет (см. п.36).
**Комментарий:** Ссылка ведёт на несуществующий якорь.

## Пункт 38. Ссылки на docs/getting-started.md

**Вердикт:** CONFIRMED
**Файл:** `docs/testing.md:10`, `vitest.config.ts:8`
**Доказательство:** Обе ссылки указывают на `getting-started.md`;
glob `docs/getting-started.md` - "No files found",
в листинге `docs/` файла нет.
**Комментарий:** Обе ссылки битые.

### Группа 7. Зависимости и CI

## Пункт 39. Неиспользуемые dependencies

**Вердикт:** CONFIRMED
**Файл:** `package.json:9-12`
**Доказательство:** В `dependencies`: `fastify`, `@fastify/static`,
`@opencode-ai/sdk`; grep импортов по `src/` и `scripts/` -
ноль (в `src/server/` только `storage/`, транспорт LLM -
свой fetch в `client.ts:1-8`).
**Комментарий:** Все три пакета - мёртвый вес;
удаление требует правки package.json и lock-файла.

## Пункт 40. Лишний @next/eslint-plugin-next

**Вердикт:** CONFIRMED
**Файл:** `package.json:25`, `eslint.config.js:2-11`
**Доказательство:** Пакет в devDependencies; в конфиге
импорты только js/markdown/ts/jsdoc/jsxA11y/react/reactHooks -
next-плагина нет; проект на Vite+React, `next.config.*` нет.
**Комментарий:** Пакет не подключён и не нужен; бонус -
его удаление закроет одну high-уязвимость (п.45).

## Пункт 41. Лишний prettier-plugin-tailwindcss

**Вердикт:** CONFIRMED
**Файл:** `.prettierrc:10`, `package.json:44`
**Доказательство:** Плагин в `.prettierrc` и devDependencies;
`tailwind` в зависимостях нет, `tailwind.config.*`,
`postcss.config.*` и CSS-файлов нет (см. п.42).
**Комментарий:** Tailwind в проекте нет, плагин форматирует
несуществующие классы.

## Пункт 42. stylelint без CSS/SCSS

**Вердикт:** CONFIRMED
**Файл:** `.stylelintrc.json:1-40`
**Доказательство:** Конфиг на 40 строк существует; поиск
`**/*.{css,scss}` вне `node_modules` - 0 файлов.
Скрипт `lint:css` использует `--allow-empty-input`.
**Комментарий:** Конфиг, три пакета и хук обслуживают ноль файлов.

## Пункт 43. CI без build, покрытия, матрицы

**Вердикт:** CONFIRMED
**Файл:** `.github/workflows/ci.yml:1-47`
**Доказательство:** Триггеры только `push/PR на main`;
джобы `lint` (lint, typecheck, file-length, lint:css, lint:md,
format) и `test` (`npm test` без `--coverage`); шага build нет,
порога покрытия нет, один `ubuntu-latest` с версией из `.nvmrc`.
**Комментарий:** CI не контролирует ни сборку, ни покрытие гейтом.

## Пункт 44. engines.node против среды

**Вердикт:** PARTIAL
**Файл:** `package.json:89-92`
**Доказательство:** `engines: node >=24.15.0, npm >=11.0.0`;
факт: `node v24.21.0`, `npm 11.19.0`, `.nvmrc` = `24`;
`.npmrc` отсутствует, `engine-strict` не включён.
**Комментарий:** Посылка "среда ниже 24" опровергнута;
подтверждено лишь отсутствие enforcement.

## Пункт 45. npm audit

**Вердикт:** CONFIRMED
**Файл:** вывод `npm audit --json`
**Доказательство:** Всего 14: critical 0, high 11, moderate 3,
low 0. High - цепочка stylelint + micromatch/braces/fast-glob/globby
(транзитивные, dev-only) + `@next/eslint-plugin-next`.
Moderate - `mammoth -> argparse@1.0.10 -> sprintf-js@1.0.3`.
Runtime (prod) - только 3 moderate из `mammoth`.
**Комментарий:** Все 11 high - dev-only и частично уйдут
с удалением пакетов из п.40/42.

## Пункт 46. Pre-commit длительность

**Вердикт:** CONFIRMED
**Файл:** `.husky/pre-commit:1-3`
**Доказательство:** Три строки: `npx lint-staged`
(prettier + eslint + stylelint + markdownlint по staged),
полный `npm test` по всему `src/**`, затем
`node scripts/check-file-length.ts`. Полный запуск хука
не выполнялся (оценка по составу).
**Комментарий:** Доминирует полный `npm test` - хук длится
минуты даже при однострочном коммите.

### Группа 8. Прочее

## Пункт 47. extractHtmlText склеивает class/id

**Вердикт:** CONFIRMED
**Файл:** `src/pipeline/stage1/read-file.ts:134-142,157-161`
**Доказательство:** `classPattern = /(?:class|id)="([^"]*)"/gi`,
значения дописываются: `[...blocks, ...classes].join("\n")`.
Реплика: `<div class="resume-header" id="main-block">...` ->
`"Engineer\nresume-header\nmain-block\njob-title"`.
Далее результат идёт в `readHtmlFile` - текст для LLM этапа 2.
**Комментарий:** Значения class/id реально попадают в текст;
тест покрывает только script/style.

## Пункт 48. confident игнорируется

**Вердикт:** CONFIRMED
**Файл:** `src/pipeline/stage1/read-file.ts:20,57,66`
**Доказательство:** `detectEncoding(buffer): { encoding: string; confident: boolean }`
возвращает `confident`; вызов: `const { encoding } = detectEncoding(buffer)` -
поле деструктуризацией отброшено и далее не используется.
**Комментарий:** Низкая уверенность детекта никак
не сигнализируется вызывающему коду.

## Пункт 49. waitForAssistant без фильтра role

**Вердикт:** CONFIRMED
**Файл:** `src/llm/polling.ts:13-36,89`
**Доказательство:** `messageText` возвращает первый непустой
`text` без проверки роли (проверка `type === "assistant"` -
только в fallback-ветке); `waitForAssistant` берёт первое
текстовое сообщение сессии. `polling.test.ts` не существует.
**Комментарий:** При тексте пользователя в сессии функция
вернёт его вместо ответа ассистента; регрессионного теста нет.

## Пункт 50. Тесты 21/22 отсутствуют

**Вердикт:** PARTIAL
**Файл:** `docs/superpowers/plans/BUILD.md:105,168`
**Доказательство:** Шаг 7: `- [x] Тест 22 (path traversal)` -
реализован в `paths.test.ts:21-41`. Шаг 13:
`- [ ] Тест 21 (XSS)` - чекбокс пуст; grep xss/escape
по `src/ui` - ноль.
**Комментарий:** Тест 22 реализован на server-стороне,
отсутствует только тест 21 (XSS, UI).

## Проверки

```text
npm run test:coverage — Statements 90.47% (1805/1995),
Branches 77.95% (810/1039), Functions 96.15% (375/390),
Lines 90.34% (1722/1906). 63 файла, 410 тестов, всё зелёное.
```

```text
npm audit — всего 14: critical 0, high 11, moderate 3, low 0.
Runtime (prod): 3 moderate (mammoth -> argparse -> sprintf-js).
```

```text
git log --oneline -1 — 5d4534d docs: update changelog
```
