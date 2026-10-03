#!/usr/bin/env node
// 包工头关键词唤起：Claude Code 的 UserPromptSubmit 钩子。
// 用户消息命中关键词时，向 AI 注入一段提示，要求先加载 baogongtou skill，
// 不让 AI 按自己的理解直接写需求或开工。没命中时什么都不输出。
// 安装方式见 README「关键词强制唤起」一节。

// 指令类：命中即唤起
const STRONG = [
  /包工头/, /baogongtou/i, /总指挥模式/, /接手总指挥/,
  /写需求/, /需求文档/, /整理需求/, /整理成需求/, /出需求/, /梳理需求/,
  /\bPRD\b/i, /拆期/, /分期开发/, /开发提示词/, /[评复]审需求/,
  /按期次/, /从期\s*\d+\s*开工/,
];

// 确认类：只在讨论功能需求时唤起，由 AI 判断语境
const CONFIRM = [
  /需求确认/, /确认需求/, /需求(就)?(这么|这样)?定了/, /就这么定了/, /就这样定了/,
  /按这个(方案)?(来|做|执行)/, /按这个方案/, /方案(就)?(确定|定了|就这样)/,
  /整理成文档/, /落成文档/, /写成文档/, /可以开始写/, /可以开工/, /开工吧/,
];

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { data += c; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(data));
  });
}

function emit(text) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: text },
  }));
}

(async () => {
  let prompt = '';
  try {
    const input = JSON.parse(await readStdin());
    prompt = input.prompt ?? input.user_message ?? input.message ?? '';
  } catch {
    return;
  }
  if (typeof prompt !== 'string' || !prompt) return;

  const hit = (list) => {
    for (const re of list) {
      const m = prompt.match(re);
      if (m) return m[0];
    }
    return null;
  };

  const strong = hit(STRONG);
  if (strong) {
    emit(
      `【包工头触发】用户消息命中关键词「${strong}」。必须先用 Skill 工具加载 baogongtou（本会话已加载过就不重复加载），` +
      '严格按 skill 流程执行，不得按自己的理解直接写需求文档或代码。' +
      '回复第一句告诉用户：“已开启包工头模式（当前阶段：需求编写 / 包工头施工 / 接手）”，按实际阶段二选一或三选一。'
    );
    return;
  }

  const confirm = hit(CONFIRM);
  if (confirm) {
    emit(
      `【包工头触发·确认类】用户消息命中确认类说法「${confirm}」。先判断当前对话是不是在讨论一个功能需求` +
      '（新功能或功能改动，而不是单个 BUG 或一处小调整）：' +
      '是 → 必须先用 Skill 工具加载 baogongtou（本会话已加载过就不重复加载），按 skill 流程把讨论内容整理成需求，' +
      '不得按自己的理解直接写需求文档或代码，回复第一句告诉用户“已开启包工头模式（当前阶段：需求编写）”；' +
      '否 → 忽略本提示，正常处理。'
    );
  }
})();
