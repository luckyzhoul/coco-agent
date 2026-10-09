import type { ModelConfig } from '../../shared/types';
import { chatComplete } from '../models/chatClient';

/** newSession 时写入的占位标题前缀；仍以此开头说明尚未生成过真实标题。 */
export const DEFAULT_TITLE_PREFIX = '新对话';

/** 标题是否仍是占位值（即尚未生成过）。 */
export function isPlaceholderTitle(title: string): boolean {
  return title.trim().startsWith(DEFAULT_TITLE_PREFIX);
}

/**
 * 不调用模型时的回退标题：取首条用户消息的首个非空行。
 * 相比旧的「截取助手回复」做法，用户消息更能反映对话主题。
 */
export function deriveFallbackTitle(userText: string): string {
  const firstLine =
    userText
      .trim()
      .split('\n')
      .map((l) => l.trim())
      .find(Boolean) || '';
  return firstLine.slice(0, 24);
}

const TITLE_PROMPT = `你是会话标题生成器。根据用户的第一条消息，概括这段对话的主题，生成一个简洁的中文标题。
要求：不超过 15 个字，不要引号、句号或任何解释，直接输出标题本身。`;

/**
 * 用一次轻量补全把首条用户消息总结成标题。
 * 失败时由调用方回退到 deriveFallbackTitle。
 */
export async function generateTitle(
  model: ModelConfig,
  userText: string,
  timeoutMs = 20000
): Promise<string> {
  const excerpt = userText.trim().slice(0, 600);
  const reply = await chatComplete(
    model,
    `${TITLE_PROMPT}\n\n用户第一条消息：\n${excerpt}`,
    32,
    timeoutMs
  );
  // 模型偶尔会带引号或换行，清理后只保留首行。
  const cleaned = reply
    .replace(/^["'“”『「【\s]+/, '')
    .replace(/["'“”』」】\s]+$/, '')
    .split('\n')[0]
    .trim();
  return cleaned.slice(0, 30);
}
