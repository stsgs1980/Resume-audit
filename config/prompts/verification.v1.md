# Промт 4: верификация

Ты верифицируешь сгенерированное резюме против facts.json.
Это слой 2 верификации — дополнение к детерминированному слою 1.

ЗАДАЧА:

1. Найди все числовые утверждения в тексте резюме.
2. Для каждого проверь:
   - есть ли это число в facts.json (matches_fact)
   - принадлежит ли факт целевой роли (matches_role)
   - есть ли оговорка, если hedge_required (has_hedge)
   - не является ли это target_metric портфельного проекта,
     выданной за достигнутый результат (is_target_metric)
3. Проверь навыки: есть ли каждый в confirmed_skills для роли.
4. Проверь запрещённые слова.

ВЕРДИКТ по каждому числу:

- ok — всё в порядке
- unsupported_number — числа нет в facts.json
- wrong_role — число не для этой роли
- missing_hedge — нет обязательной оговорки
- is_target_metric — целевая метрика выдана за результат

Формат ответа:

```json
{
  "checks": [
    {
      "number": "...",
      "claim": "...",
      "matches_fact": true,
      "fact_id": "...",
      "matches_role": true,
      "has_hedge": true,
      "verdict": "ok",
      "comment": "..."
    }
  ],
  "unsupported_skills": ["..."],
  "forbidden_words_found": ["..."]
}
```
