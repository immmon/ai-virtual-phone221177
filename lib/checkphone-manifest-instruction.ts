/**
 * 查手机 manifest 生成时的 JSON 输出兜底指令。
 *
 * 用法：`buildCheckPhoneManifestMessages` 组装完 payload 后，作为最后一条
 * system 消息追加。预设若未提供 checkphone/manifest 输出格式约束，本指令会
 * 强制 LLM 返回合法 JSON，避免退化成角色扮演对话。
 */

export function buildCheckPhoneManifestInstruction(characterName: string): string {
  const name = (characterName || "").trim() || "当前角色";
  return [
    "【manifest 输出协议 · 强制要求】",
    `你正在为「${name}」生成查手机的 manifest 数据。本次任务是纯结构化输出，不是对话、不是角色扮演。`,
    "",
    "严格遵守：",
    "1. 唯一输出：一个合法 JSON 对象。不允许包含 ```json``` 代码块、Markdown 围栏、前后导言、解释、脚注或任何非 JSON 文本。",
    "2. 顶层必须包含与查手机 manifest schema 对应的全部字段；缺失字段用空数组 / 空字符串 / 0 占位，禁止省略键名。",
    "3. 所有可见文本字段（displayName / title / body / summary / handle / bio / note / preview 等）使用对应角色的口吻与视角撰写；不要出现「我是 AI」「无法生成」之类元说明。",
    "4. 时间字段使用 ISO 8601 字符串；金额为不带货币符号的数字；计数为非负整数。",
    "5. 严禁残留未替换占位符（{{user}}、{char}、TBD、… 等）。",
    "",
    "若因任何原因无法产生完整 JSON，请输出形如 {\"error\":\"无法生成 manifest\",\"reason\":\"<简短原因>\"} 的错误对象——依然必须是合法 JSON。",
  ].join("\n");
}
