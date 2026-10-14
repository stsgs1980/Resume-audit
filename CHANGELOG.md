<!-- markdownlint-disable -->

# 1.0.0 (2026-10-14)

### Bug Fixes

- **core:** fix gap detection and causality source markers ([76cad40](https://github.com/stsgs1980/Resume-audit/commit/76cad408e3514fae0e1189dbbb0a60b22243c237))
- **husky:** run lint-staged and file-length check on pre-commit ([717dce4](https://github.com/stsgs1980/Resume-audit/commit/717dce4ed2b9862675f7997bc0008c180544f01e))
- repair changelog generation after CLI migration ([4adbbe3](https://github.com/stsgs1980/Resume-audit/commit/4adbbe313ea7117e64d3d341ad9a3ba98881d3fb))

### Features

- add layered architecture skeleton with eslint boundaries ([035caec](https://github.com/stsgs1980/Resume-audit/commit/035caec7fbdc9c2349642e09c68fc8a43f21196d))
- add Vite + React entry point and Fastify dependencies ([1d23c5f](https://github.com/stsgs1980/Resume-audit/commit/1d23c5f0e35136ce6dd8c3d349a2eb3760f59296))
- **core:** add inclusive date arithmetic and interval union ([774c72d](https://github.com/stsgs1980/Resume-audit/commit/774c72de3c5f933b25776b9a405e3f40c97fd8c1))
- **core:** add layer-1 verification (numbers, skills, hedge, fields) ([724d358](https://github.com/stsgs1980/Resume-audit/commit/724d35814fc5e61df02457334d5931172ef616b7))
- **core:** add number normalization and cross-check ([abe4853](https://github.com/stsgs1980/Resume-audit/commit/abe4853811d4f7942407d7178346315a8ea423d0))
- **core:** add per-role skill rules and content detectors ([2638b5b](https://github.com/stsgs1980/Resume-audit/commit/2638b5bb0e8564ea21de87e5ced6c8fc82627848))
- **core:** add present resolution, gaps and overlaps ([7eded4a](https://github.com/stsgs1980/Resume-audit/commit/7eded4ae6e61274bb5f96948125ad3f0106ed988))
- **llm:** add fetch-based client with structured output and checkpoints ([5c7277a](https://github.com/stsgs1980/Resume-audit/commit/5c7277a21c117552bb008c52fec2de233158aaf9))
- **schemas:** add zod schemas for facts, evidence, claims, audit, validation, stage-state ([6f82137](https://github.com/stsgs1980/Resume-audit/commit/6f821373213c9b78f7e0b0518ffdd11a3263d9ac))
- **server:** add storage layer with workspaces and atomic writes ([b6b0ae3](https://github.com/stsgs1980/Resume-audit/commit/b6b0ae3ed2d6fa5ea5a8936a6dd3d33f6bd59488))
