import { jsonrepair } from "jsonrepair";

export type JsonRepairOptions = {
  textFieldKeys: string[];
};

export type JsonRepairParseResult = {
  parsed: unknown | null;
  sanitizedCandidate: string;
  parseMode: "raw" | "sanitized" | "failed";
  parseError?: string;
};

/**
 * 在解析 JSON 之前剥除"包裹噪声"：
 * 1. 标准思维链标签块（<think>/<thinking>/<reasoning>）
 * 2. 通用兜底：所有标签名疑似"思考过程"的标签块（覆盖 <thought>/<reflection>/<cot>/<chain_of_thought> 等）
 * 3. 特殊 token 风格（<|thought|>...</|thought|>、<|begin_of_thought|>...<|end_of_thought|>）
 * 4. Markdown JSON 代码围栏
 *
 * 第二、三步是为了兼容输出格式不规范的推理模型（如 MiniMax-M3、Qwen、Llama 等非标变体），
 * 把"思考过程"误吐到 JSON 之外 / JSON 之前的情况抹掉，让下游 JSON 解析能正常跑。
 */
export function stripJsonWrapperNoise(text: string): string {
  let source = text.trim();

  // 1. 标准标签块：<think>/<thinking>/<reasoning>
  source = source.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  source = source.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "").trim();
  source = source.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "").trim();

  // 2. 通用兜底：所有标签名包含 think/reason/reflect/thought/reflexion/cot/chain-of-thought/scratchpad/analysis 的标签块
  // 例：<reflection>...</reflection>、<thought>...</thought>、<cot>...</cot>、<chain_of_thought>...</chain_of_thought>、<analysis>...</analysis>
  source = source.replace(
    /<\s*([a-zA-Z][a-zA-Z0-9_-]*(?:think|reason|reflect|thought|reflexion|cot|chain[\s_-]?of[\s_-]?thought|scratchpad|analysis)[a-zA-Z0-9_-]*)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
    "",
  ).trim();

  // 3. 特殊 token 风格（ChatML / Qwen / 部分推理模型）：<|thought|>...</|thought|>、<|begin_of_thought|>...<|end_of_thought|>
  source = source.replace(
    /<\|[^|]*?(?:think|reason|reflect|thought|reflexion|cot|chain[\s_-]?of[\s_-]?thought|scratchpad|analysis)[^|]*?\|>[\s\S]*?<\|[^|]*?(?:think|reason|reflect|thought|reflexion|cot|chain[\s_-]?of[\s_-]?thought|scratchpad|analysis)[^|]*?\|>/gi,
    "",
  ).trim();

  // 4. Markdown JSON 代码围栏
  source = source.replace(/```(?:json)?\s*([\s\S]*?)```/i, "$1").trim();

  return source;
}

export function extractJSONObjectCandidate(text: string): string {
  const source = stripJsonWrapperNoise(text);
  const firstBrace = source.indexOf("{");
  const lastBrace = source.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return source.slice(firstBrace, lastBrace + 1);
  }
  return source;
}

export function normalizeJsonTypography(text: string): string {
  return text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/，/g, ",")
    .replace(/：/g, ":");
}

export function sanitizeGenericJsonCandidate(text: string, options: JsonRepairOptions): string {
  void options;
  const normalized = normalizeJsonTypography(stripJsonWrapperNoise(text));
  const candidate = extractJSONObjectCandidate(normalized);

  try {
    return jsonrepair(candidate);
  } catch {
    return candidate;
  }
}

export function parseJsonWithRepair(
  text: string,
  options: JsonRepairOptions & { sanitizeCandidate?: (text: string) => string },
): JsonRepairParseResult {
  const rawParsed = extractJSONFromText(text);
  const sanitizedCandidate = extractJSONObjectCandidate(
    options.sanitizeCandidate
      ? options.sanitizeCandidate(text)
      : sanitizeGenericJsonCandidate(text, { textFieldKeys: options.textFieldKeys }),
  );

  if (rawParsed) {
    return {
      parsed: rawParsed,
      sanitizedCandidate,
      parseMode: "raw",
    };
  }

  const sanitizedParsed = extractJSONFromText(sanitizedCandidate);
  if (sanitizedParsed) {
    return {
      parsed: sanitizedParsed,
      sanitizedCandidate,
      parseMode: "sanitized",
    };
  }

  let parseError = "";
  try {
    JSON.parse(sanitizedCandidate);
  } catch (error) {
    parseError = error instanceof Error ? error.message : String(error);
  }

  return {
    parsed: null,
    sanitizedCandidate,
    parseMode: "failed",
    parseError: parseError || undefined,
  };
}

function extractJSONFromText(text: string): unknown | null {
  let source = text.trim();

  try {
    return JSON.parse(source);
  } catch {
    // fall through
  }

  const firstBrace = source.indexOf("{");
  const lastBrace = source.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    source = source.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(source);
    } catch {
      // fall through
    }

    try {
      return JSON.parse(jsonrepair(source));
    } catch {
      // fall through
    }
  }

  return null;
}
