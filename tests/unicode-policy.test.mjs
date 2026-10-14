import { RuleTester } from "eslint";

import unicodePolicy from "../eslint-rules/unicode-policy.js";

const tester = new RuleTester();

describe("unicode-policy/emoji", () => {
  tester.run("emoji", unicodePolicy.rules.emoji, {
    valid: ["export const ok = '[OK]';", "const s = '->';", "const path = 'docs/live-templates/README.md';"],
    invalid: [
      {
        code: "export const s = '★';",
        errors: [{ messageId: "noEmoji", line: 1 }],
      },
      {
        name: "эмодзи в комментарии",
        code: "// ★ behind the times",
        errors: [{ messageId: "noEmoji", line: 1 }],
      },
      {
        name: "два эмодзи в одной строке дают одну ошибку",
        code: "export const s = '★ ✔';",
        errors: [{ messageId: "noEmoji", line: 1 }],
      },
      {
        name: "номер строки определяется верно",
        code: "export const ok = '[OK]';\nexport const bad = '★';",
        errors: [{ messageId: "noEmoji", line: 2 }],
      },
    ],
  });
});

describe("unicode-policy/unicode-graphics", () => {
  tester.run("unicode-graphics", unicodePolicy.rules["unicode-graphics"], {
    valid: ["export const ok = 1;", "const frame = '+---+';", "const divider = '----';"],
    invalid: [
      {
        code: "export const s = '─';",
        errors: [{ messageId: "noUnicodeGraphics", line: 1 }],
      },
      {
        name: "псевдографика в комментарии",
        code: "// █ progress bar",
        errors: [{ messageId: "noUnicodeGraphics", line: 1 }],
      },
    ],
  });
});
