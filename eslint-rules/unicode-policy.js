/* eslint-disable no-misleading-character-class -- intentional emoji ranges: this file defines what to prohibit elsewhere. */
const emojiPattern = new RegExp(
  "[\\u{1F600}-\\u{1F64F}" +
    "\\u{1F300}-\\u{1F5FF}" +
    "\\u{1F680}-\\u{1F6FF}" +
    "\\u{1F1E0}-\\u{1F1FF}" +
    "\\u{2600}-\\u{27BF}" +
    "\\u{FE00}-\\u{FEFF}" +
    "\\u{1F900}-\\u{1F9FF}" +
    "\\u{1FA00}-\\u{1FA6F}" +
    "\\u{1FA70}-\\u{1FAFF}" +
    "\\u{2702}-\\u{27B0}]",
  "u",
);

const unicodeGraphicsPattern = new RegExp(
  "[\\u{2500}-\\u{257F}" + "\\u{2580}-\\u{259F}" + "\\u{25A0}-\\u{25FF}" + "\\u{2800}-\\u{28FF}]",
  "u",
);

const createRule = (messages, pattern, replaceFn = (t) => t) => {
  const create = (context) => {
    const sourceCode = context.sourceCode || context.getSourceCode();
    const text = replaceFn(sourceCode.getText());
    const lines = text.split("\n");
    return {
      Program() {
        lines.forEach((line, index) => {
          if (pattern.test(line)) {
            context.report({
              loc: { line: index + 1, column: 0 },
              messageId: Object.keys(messages)[0],
            });
          }
        });
      },
    };
  };
  return { meta: { type: "problem", messages }, create };
};

const emoji = createRule(
  {
    noEmoji: "Emoji are prohibited. Use text tags like [OK], [FAIL] instead.",
  },
  emojiPattern,
);

const unicodeGraphics = createRule(
  {
    noUnicodeGraphics: "Unicode box/line drawing characters are prohibited. Use ASCII.",
  },
  unicodeGraphicsPattern,
);

export default {
  rules: {
    emoji,
    "unicode-graphics": unicodeGraphics,
  },
};
