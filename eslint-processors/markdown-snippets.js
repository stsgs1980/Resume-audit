import markdownPlugin from "@eslint/markdown";

// noinspection JSUnresolvedVariable,JSUnresolvedFunction
const originalProcessor = markdownPlugin.processors.markdown;

export default {
  meta: { name: "markdown-snippets-processor", version: "1.0.0" },
  // noinspection JSUnresolvedVariable,JSUnresolvedFunction
  preprocess: originalProcessor.preprocess,
  // noinspection JSUnresolvedVariable,JSUnresolvedFunction
  postprocess: originalProcessor.postprocess,
  // noinspection JSUnresolvedVariable
  supportsAutofix: originalProcessor.supportsAutofix,
};
