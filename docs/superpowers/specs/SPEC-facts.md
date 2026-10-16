# SPEC-facts: архитектура фактов и схемы данных

Часть спецификации Resume Audit.
См. также: [SPEC.md](SPEC.md), [SPEC-dates.md](SPEC-dates.md).

## 1. Разделение файлов

`facts.json` содержит только факты. Ничего производного, никаких правил,
никаких оценок.

```text
data/
  facts.json          <- факты: работа, образование, языки, навыки,
                         проекты. ИСТОЧНИК ПРАВДЫ.
  evidence/<id>.json  <- карточки доказательств
  audit.json          <- противоречия, вопросы, роли, ATS
  claims.json         <- этап 2: утверждения с цитатами
  files.json          <- этап 1: инвентарь файлов
  validation.json     <- этап 8: верификация
  stage-state.json    <- статусы + facts_hash документов
  resumes/            <- сгенерированные версии
  logs/               <- model-responses.log
```

### 1.1. Мульти-воркспейсы

- Все файлы проекта хранятся в `data/workspaces/<slug>/`:
  `facts.json`, `evidence/`, `audit.json`, `claims.json`,
  `validation.json`, `stage-state.json`, `resumes/`.
- Переключение между проектами в UI через выпадающий список.
- Один проект = один workspace. Импорт/экспорт архива `.zip`
  (реализация — позже).
- Плоская структура `data/*` без `workspaces` — устаревшая,
  не использовать.

## 2. Причина разделения

Если `contradictions` лежат в `facts.json`, а правила аудита меняются,
«источник правды» меняет содержимое вслед за правилами. Это циклическая
зависимость: критерий проверки фактов сам становится зависимым от правил.

Факты должны быть стабильны при смене правил.

## 3. Что вычисляется, а что хранится

`total_experience`, `share_of_applications` и любые производные поля
не хранятся в `facts.json`.

Они вычисляются при каждом чтении и отображаются в UI как read-only.

`share_of_applications` — редактируемое поле с валидацией суммы: значения
всех целевых ролей должны давать сумму в диапазоне 0.99–1.01.
При нарушении — ошибка сохранения с подсветкой роли.

## 4. Схема facts.json

```json
{
  "schema_version": 1,
  "meta": {
    "candidate_name": "",
    "audit_date": "YYYY-MM-DD",
    "geography": "",
    "targets": [
      { "id": "sales", "title": "", "share_of_applications": 0.7 },
      { "id": "salesops", "title": "", "share_of_applications": 0.25 },
      { "id": "aipo", "title": "", "share_of_applications": 0.05 }
    ]
  },
  "jobs": [
    {
      "id": "job1",
      "company": "",
      "industry": "",
      "position": "",
      "start": "YYYY-MM",
      "end": "YYYY-MM",
      "is_current": false,
      "overlap_group": null,
      "parallel_justification": "",
      "team_size": "",
      "context": "",
      "actions": [],
      "results": [
        {
          "id": "res1",
          "key": "",
          "text": "",
          "number": null,
          "unit": "",
          "currency": null,
          "status": "confirmed | needs_evidence | remove",
          "roles": ["sales", "salesops", "aipo"],
          "evidence_id": "res1",
          "hedge_required": false
        }
      ],
      "source_files": []
    }
  ],
  "education": [
    {
      "id": "edu1",
      "institution": "",
      "program": "",
      "start": "YYYY-MM",
      "end": "YYYY-MM"
    }
  ],
  "languages": [{ "id": "lang1", "name": "", "level": "" }],
  "confirmed_skills": [{ "id": "sk1", "skill": "", "roles": ["sales"] }],
  "portfolio_projects": [{ "id": "prj1", "title": "", "description": "", "roles": ["sales"] }]
}
```

Источник правды — `src/schemas/facts.ts`. В Zod описательные поля
опциональны: `industry`, `parallel_justification`, `team_size`,
`context`, `actions`, `results`, `source_files` у job;
`program`, `start`, `end` у education; `level` у language;
`description`, `roles` у portfolio_projects. `end` у job может быть
`null` или отсутствовать, когда `is_current: true`.
`overlap_group` — `string | null`, тоже опционален.

`schema_version: z.literal(1)`. При росте версии — добавить v2
и migration в `migrations/`.

## 5. Поле roles

Поле `roles` у каждого результата, навыка и проекта — per-role allowlist.

Верификатор сверяет не только наличие числа в `facts.json`, но и
принадлежность целевой роли. Без этого цифра из Sales Operations-контекста
проходит в версию AI Product Owner, и проверка её не ловит.

Роли результата определяются на этапе 4 из контекста утверждения:
`detected_roles` claim (этап 2) сужает allowlist до явно упомянутых
ролей. Пересечение с целевыми обязательно: роль, которой нет
в `meta.targets`, отбрасывается. Нет признаков роли — результат
получает все целевые роли.

## 6. Поле evidence_id

Ссылается на карточку доказательства в `data/evidence/<id>.json`,
где `<id>` — `evidence_id` результата (совпадает с `id` результата:
файл `evidence/res1.json` для результата `res1`).

Связь claim -> result хранит опциональное поле результата
`source_claim_id` (id утверждения этапа 2, из которого построен
результат). Карточка ищется по `source_claim_id` из
`relatedClaimIds` вопроса; без связи пишется fallback
по claim id с предупреждением `evidence_unlinked`.

Карточка заполняется человеком на этапе 4. Обязательные поля:
`source_file`, `quote`, `metric_definition`, `period`, `baseline`,
`source_of_data`, `zone_of_influence`, `confirmed_by`, `confirmed_on`.

Схема карточки:

```json
{
  "fact_id": "res1",
  "source_file": "resume_v2.docx",
  "quote": "рост выручки на 4,2 млн руб. за 2023",
  "metric_definition": "выручка по направлению X",
  "formula": "выручка_2023 - выручка_2022",
  "period": "2023-01 - 2023-12",
  "baseline": "выручка_2022 = 18,4 млн",
  "source_of_data": "по данным компании",
  "zone_of_influence": "направление X, 4 менеджера",
  "confirmed_by": "кандидат",
  "confirmed_on": "2026-10-09",
  "status": "draft | pending | confirmed | rejected"
}
```

Жизненный цикл: `draft -> pending -> confirmed | rejected`.

Только `confirmed` evidence позволяет факту попасть в `facts.json`
как `confirmed`. `needs_evidence` без `confirmed` evidence блокирует экспорт.

## 7. Поле hedge_required

Маркер того, что результат можно использовать только с честной оговоркой.

Ставится на этапе 4 из утверждения: `requires_hedge` claim (этап 2)
помечает косвенные метрики — результат достигнут другой стороной,
прогноз или цель, эффект без прямого контроля кандидата. Признака
нет — `false`.

Верификация проверяет наличие оговорки рядом с числом.

## 8. Матрица status x hedge_required

| status         | hedge_required | Что делает генерация                          |
| -------------- | -------------- | --------------------------------------------- |
| confirmed      | false          | Использует свободно, число в блок результатов |
| confirmed      | true           | Использует с оговоркой в том же абзаце        |
| needs_evidence | true           | Только с оговоркой, блокирует экспорт         |
| needs_evidence | false          | Не должно быть, предупреждение при сохранении |
| remove         | любое          | Не используется вообще                        |

Плюс проверка `roles`: число допускается в версию только если целевая
роль есть в `roles` факта.

## 9. Схема claims.json

Результат этапа 2. Утверждение без цитаты удаляется кодом.

```json
{
  "claims": [
    {
      "id": "claim1",
      "statement": "",
      "quote": "",
      "source_file": "",
      "category": "employment | result | skill | tool | education | language | project | link",
      "metric_type": "свободная строка или null (например выручка, конверсия, иное)",
      "number": null,
      "currency": "RUB | USD | EUR | null",
      "status": "confirmed | needs_evidence | remove",
      "reason": "",
      "detected_roles": ["sales"],
      "requires_hedge": false
    }
  ]
}
```

Источник правды — `src/schemas/claims.ts`. Обязательны `id`,
`statement`, `quote`, `source_file`, `category`, `status`.
Опциональны `metric_type`, `number`, `currency`, `reason`,
`detected_roles` (роли, явно упомянутые в контексте) и
`requires_hedge` (косвенная метрика, требуется оговорка).
Утверждение без цитаты удаляется кодом — см. раздел
про валидацию при сохранении ниже.

## 10. Схема audit.json

Производное от `facts.json` и правил. Меняется при смене правил.

```json
{
  "facts_hash": "sha256:...",
  "meta_hash": "sha256:...",
  "generated_at": "YYYY-MM-DDTHH:MM:SSZ",
  "contradictions": [{ "id": "c1", "description": "" }],
  "open_questions": [{ "id": "q1", "question": "", "status": "" }],
  "warnings": [{ "code": "", "message": "" }],
  "roles": [{ "role_id": "sales", "verdict": "", "score": 0 }],
  "ats": { "<keyword>": {} }
}
```

Источник правды — `src/schemas/audit.ts`. `contradiction` — это
`{ id, description }`; `open_question` — `{ id, question }` плюс
опциональный `status`; `warning` — `{ code, message }`;
`roleAssessment` — `{ role_id }` плюс опциональные `verdict`, `score`.
`ats` — свободная запись `record<string, unknown>`, а не фиксированная
структура.

## 11. Схема stage-state.json

Хранит статус каждого этапа и `facts_hash` каждого документа.

```json
{
  "run_id": "run_2026-10-09_001",
  "stages": {
    "1": { "status": "completed", "updated_at": "" },
    "4": { "status": "running", "updated_at": "" }
  },
  "documents": {
    "hh_v1_sales": {
      "facts_hash": "sha256:...",
      "prompt_version": "generation.sales.v1",
      "model_id": "opencode/big-pickle",
      "generated_at": "",
      "stale": false
    },
    "hh_v2_salesops": { "stale": true }
  }
}
```

Статусы этапов: `pending`, `running`, `completed`, `failed`, `incomplete`,
`stale`, `blocked`.

Инвалидация по-документная. Перегенерация версии 2 не помечает версии 1
и 3 устаревшими — у каждой документа своя запись.

Глобальный флаг `allStale` — ошибка проектирования.

Источник правды — `src/schemas/stage-state.ts`. `run_id` — `z.string()`,
не nullable; при отсутствии файла возвращается `""`.
В записи документа
обязателен только `stale: boolean`; `facts_hash`, `prompt_version`,
`model_id`, `generated_at` опциональны — поэтому запись вида
`{ "stale": true }` валидна.

## 12. Схема validation.json

Результат этапа 8. Два вложенных объекта: `layer1` (код)
и `layer2` (LLM). Верхний уровень строгий: лишние поля отклоняются.

```json
{
  "layer1": {
    "ok": false,
    "numberErrors": [],
    "skillErrors": ["SQL"],
    "forbiddenFound": [],
    "hedgeErrors": [],
    "missingFields": [],
    "shareSumOk": true,
    "exceptions": ["+7 (926) 065-97-20"]
  },
  "layer2": {
    "checks": [
      {
        "number": "4,2 млн",
        "claim": "рост выручки",
        "matches_fact": true,
        "fact_id": "res1",
        "matches_role": true,
        "has_hedge": false,
        "verdict": "ok",
        "comment": ""
      }
    ],
    "unsupported_skills": ["Go"],
    "forbidden_words_found": []
  }
}
```

Источник правды — `src/schemas/validation.ts`. Форма `layer1`
повторяет `VerificationResult` из `src/core/verification.ts`:
обязателен только `ok: boolean`, остальные списки опциональны.
Форма `layer2` — из [SPEC-verification.md](SPEC-verification.md),
раздел 3; `verdict` — `ok | unsupported_number | wrong_role |
missing_hedge | is_target_metric`.

Долг, не финал: точная форма `layer1` может уточниться при развитии
верификации (новые виды проверок — новые поля). При изменении —
обновить схему, этот раздел и миграцию одновременно.

## 13. Валидация при сохранении

Каждое сохранение `facts.json` из интерфейса проходит JSON Schema
валидацию.

- Поля `date` — строгий формат `YYYY-MM`.
- Поле `number` — число или `null`, строка отклоняется.
- `share_of_applications` — проверка суммы.
- Ошибки валидации показываются у конкретного поля, не общим текстом.
- Запись атомарная: временный файл, затем `rename`.

## 14. Версионирование артефактов

Каждый артефакт несёт: `schema_version`, `prompt_version`, `model_id`,
`model_params`, `run_id`, `created_at`, `facts_hash`, `meta_hash`.

Это даёт воспроизводимость для детерминированного ядра, трассировку,
миграции, отладку.
