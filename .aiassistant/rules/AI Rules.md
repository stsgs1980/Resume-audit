---
apply: always
---

# AI Workflow Rules (WebStorm + Opencode.ai)

## 1. Language & Communication

- Always respond in Russian.
- Code, commands, and file names stay in English.
- Never use emoji or Unicode box/line drawing characters in responses or code.
  Use text tags like [OK], [FAIL], [TODO], [WARNING], [INFO] instead.

## 2. Rule Zero: Answer Before Act

Before any action, classify the user's request:

- Question: answer in text, do NOT create or modify files.
- Task: execute it.
- Unclear: ask for clarification.
- Confirmation ("yes", "go ahead", "continue"): execute the agreed plan.

## 3. Code Style & Formatting

- TypeScript strict mode. Explicit typing for all parameters and return values (no `any`).
- Semicolons are required.
- Strings use double quotes.
- Trailing commas required in objects and arrays.
- Indentation is 2 spaces.
- Max line length is 120 characters.
- Max file length is 250 lines. If exceeded, split into modules.
- JSDoc with @param and @returns required for every function, method, and React component.
- Markdown: follow `docs/markdown.md` — 120 chars per line, aligned tables, `npm run lint:md`.
- Markdown code blocks must specify a language (e.g., ```typescript, not empty).
- Markdown with JSX in fenced blocks must use `tsx`, not `typescript` (WebStorm injection).
- WebStorm IDE setup: `docs/webstorm.md` (code style import and on-save tools are manual).

## 4. Anti-Monolith (Auto-Activation)

This skill MUST activate automatically when ANY of these conditions are detected:

- File exceeds 250 lines (TS/JS) or component exceeds 200 lines.
- 3+ `useState` in one component (extract to custom hook).
- Function exceeds 50 lines.

When a threshold is crossed:

1. STOP writing the monolith.
2. Announce: `[ANTI-MONOLITH] Threshold exceeded: <reason>`
3. Apply decomposition: extract subcomponents, extract hooks, separate data fetching.
4. Continue the task with decomposed modules.

## 5. Clean Code & Architecture

- Never hardcode absolute paths in code (use env vars).
- Always read a file before editing it.

## 6. Git & Commits

- All commits MUST follow Conventional Commits format:
  type(scope): short description
- Allowed types: feat, fix, docs, style, refactor, test, chore, perf, ci, build.
- Do not commit directly to main without verification.
- Pre-commit hooks (Husky + lint-staged) must pass before commit.
- Pre-push hook generates CHANGELOG.md only on main branch (on other branches it skips silently).
  If file changed, push blocked — commit CHANGELOG first: `git add CHANGELOG.md && git commit -m "docs: update changelog"`.

## 7. Systematic Debugging & Work Cycle

- Work Cycle: Read, Plan, Execute, Record, Commit.
- When debugging: reproduce locally, identify root cause (do not patch symptoms),
  write a test that fails before the fix and passes after.
- Do not skip pre-commit checks.
