<!-- markdownlint-disable -->

# 1.0.0 (2026-10-16)

### Bug Fixes

- **build:** check untracked files in file-length script ([f797600](https://github.com/stsgs1980/Resume-audit/commit/f7976006532f86489c861d7a95cb5268567ae7d5))
- **core:** fix gap detection and causality source markers ([76cad40](https://github.com/stsgs1980/Resume-audit/commit/76cad408e3514fae0e1189dbbb0a60b22243c237))
- **husky:** run lint-staged and file-length check on pre-commit ([717dce4](https://github.com/stsgs1980/Resume-audit/commit/717dce4ed2b9862675f7997bc0008c180544f01e))
- **pipeline:** block export on forbidden words, placeholders, target metrics ([7dc0fb9](https://github.com/stsgs1980/Resume-audit/commit/7dc0fb93a1d40d639d42b140a50d071f706a1739))
- **pipeline:** unify lock format, evidence id, and fail-closed facts write ([dbd2b59](https://github.com/stsgs1980/Resume-audit/commit/dbd2b599cbed4060a54dfb98ee510bb26879d60d))
- repair changelog generation after CLI migration ([4adbbe3](https://github.com/stsgs1980/Resume-audit/commit/4adbbe313ea7117e64d3d341ad9a3ba98881d3fb))
- **schemas:** strict year-month and job consistency validation ([c02f8bd](https://github.com/stsgs1980/Resume-audit/commit/c02f8bda7c34934e4809bdcd5be445ccfa5f6d98))

### Features

- add layered architecture skeleton with eslint boundaries ([035caec](https://github.com/stsgs1980/Resume-audit/commit/035caec7fbdc9c2349642e09c68fc8a43f21196d))
- add Vite + React entry point and Fastify dependencies ([1d23c5f](https://github.com/stsgs1980/Resume-audit/commit/1d23c5f0e35136ce6dd8c3d349a2eb3760f59296))
- **core:** add inclusive date arithmetic and interval union ([774c72d](https://github.com/stsgs1980/Resume-audit/commit/774c72de3c5f933b25776b9a405e3f40c97fd8c1))
- **core:** add layer-1 verification (numbers, skills, hedge, fields) ([724d358](https://github.com/stsgs1980/Resume-audit/commit/724d35814fc5e61df02457334d5931172ef616b7))
- **core:** add number normalization and cross-check ([abe4853](https://github.com/stsgs1980/Resume-audit/commit/abe4853811d4f7942407d7178346315a8ea423d0))
- **core:** add per-role skill rules and content detectors ([2638b5b](https://github.com/stsgs1980/Resume-audit/commit/2638b5bb0e8564ea21de87e5ced6c8fc82627848))
- **core:** add present resolution, gaps and overlaps ([7eded4a](https://github.com/stsgs1980/Resume-audit/commit/7eded4ae6e61274bb5f96948125ad3f0106ed988))
- **llm:** add fetch-based client with structured output and checkpoints ([5c7277a](https://github.com/stsgs1980/Resume-audit/commit/5c7277a21c117552bb008c52fec2de233158aaf9))
- **llm:** add prompt loader, response schemas, and prompt registry ([0090e03](https://github.com/stsgs1980/Resume-audit/commit/0090e0324c5976bacc842371209108a1d17f6d80))
- **llm:** add remaining LLM prompts (roles, generation, verification) ([e15feab](https://github.com/stsgs1980/Resume-audit/commit/e15feab397b17d19cdccac728a546a1ff5d9a6ea))
- **llm:** add request logging with rotation ([41172d7](https://github.com/stsgs1980/Resume-audit/commit/41172d7be464ca76109937f235e423be7d54ab8e))
- **pipeline:** add pipeline layer with eslint boundaries ([7982c68](https://github.com/stsgs1980/Resume-audit/commit/7982c686a96273214b4f0e4f587fbc0878ff3fe8))
- **pipeline:** add stage 1 file inventory with classification ([93ee2b4](https://github.com/stsgs1980/Resume-audit/commit/93ee2b4888d232aef92f5a809e05ceb93f6be52c))
- **pipeline:** add stage 2 claims extraction via LLM ([5a8f352](https://github.com/stsgs1980/Resume-audit/commit/5a8f3528f12d4902ff4271d595567bdb7460d738))
- **pipeline:** add stage 3a contradictions and open questions ([a32a2cf](https://github.com/stsgs1980/Resume-audit/commit/a32a2cff6a67e103643a6a2040d6f65ce8927e75))
- **pipeline:** add stage 3b roles assessment and ATS analysis ([b0388c8](https://github.com/stsgs1980/Resume-audit/commit/b0388c89781c25fc11c1ca6189bf9f3ff1e5d6b7))
- **pipeline:** add stage 4a facts skeleton from claims ([f0bed20](https://github.com/stsgs1980/Resume-audit/commit/f0bed2001760fd6ca73f7c9894925aa9ad416263))
- **pipeline:** add stage 4b review CLI with evidence and lock ([23a2d09](https://github.com/stsgs1980/Resume-audit/commit/23a2d09d3e6c3d918a5e56237d6182f4b787f903))
- **pipeline:** add stage 7 resume generation for three roles ([87b2dd0](https://github.com/stsgs1980/Resume-audit/commit/87b2dd03429c911aba7fefbb80d8b9f2d0450f1d))
- **pipeline:** add stage 8 two-layer verification ([049e1a6](https://github.com/stsgs1980/Resume-audit/commit/049e1a68b90ed239a863ef72f20f4496fbe2878c))
- **schemas:** add zod schemas for facts, evidence, claims, audit, validation, stage-state ([6f82137](https://github.com/stsgs1980/Resume-audit/commit/6f821373213c9b78f7e0b0518ffdd11a3263d9ac))
- **server:** add storage layer with workspaces and atomic writes ([b6b0ae3](https://github.com/stsgs1980/Resume-audit/commit/b6b0ae3ed2d6fa5ea5a8936a6dd3d33f6bd59488))
