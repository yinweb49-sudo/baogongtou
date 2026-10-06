#!/usr/bin/env node
// 包工头关键词唤起：Claude Code 的 UserPromptSubmit 钩子。
// 用户消息命中关键词时，向 AI 注入一段提示，要求先加载 baogongtou skill（确认类先判断是不是小活），
// 不让 AI 按自己的理解直接写需求或开工。没命中时什么都不输出。
// 安装方式见 README「关键词强制唤起」一节。

// 指令类：命中即唤起
const STRONG = [
  /包工头/, /baogongtou/i, /总指挥模式/, /接手总指挥/, /全自动模式/, /开全自动/,
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

// 在包工头自己的仓库或安装目录里（维护 skill 时）不触发：
// 从当前目录逐级往上找，遇到 name 为 baogongtou 的 SKILL.md 就跳过。
function insideSkillRepo(cwd) {
  const fs = require('fs');
  const path = require('path');
  let dir = cwd;
  for (let i = 0; dir && i < 30; i++) {
    try {
      const head = fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8').slice(0, 300);
      if (/^name:\s*baogongtou\s*$/m.test(head)) return true;
    } catch {}
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return false;
}

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
  let cwd = '';
  try {
    const input = JSON.parse(await readStdin());
    prompt = input.prompt ?? input.user_message ?? input.message ?? '';
    cwd = typeof input.cwd === 'string' ? input.cwd : '';
  } catch {
    return;
  }
  if (typeof prompt !== 'string' || !prompt) return;
  if (cwd && insideSkillRepo(cwd)) return;

  const hit = (list) => {
    for (const re of list) {
      const m = prompt.match(re);
      if (m) return m[0];
    }
    return null;
  };

  // 小活判定与中途升级信号，和 SKILL.md“先分诊”“中途升级”保持一致
  const SMALL =
    '小活（同时满足：一处改动、一次对话改得完；不新增页面或流程；不改钱 / 权限 / 删除 / 迁移的规则；' +
    '不推翻已有需求文档里已确认的决定）';
  const UPGRADE =
    '做的过程中若同一件事（在前一次结果上接着改、为同一个目标）出现追加修改 3 轮以上且范围变大、要跨前后端或数据库、' +
    '这件事一次对话改不完、要改钱 / 权限 / 删除 / 迁移规则、与已定决定冲突之一，立即加载 baogongtou 按“中途升级”自动升级，' +
    '不必等用户同意；一个对话里接连做多件不相关的小事不算，每件单独判断、不累计。';

  const strong = hit(STRONG);
  if (strong) {
    emit(
      `【包工头触发】用户消息命中关键词「${strong}」。必须先用 Skill 工具加载 baogongtou（本会话已加载过就不重复加载），` +
      '严格按 skill 流程执行，不得按自己的理解直接写需求文档或代码。' +
      '用户明确要求走包工头、写需求文档、拆期、开全自动、接手时照做；只是顺口提到关键词' +
      '（如“需求文档里那个按钮改一下”）时，按 skill“先分诊”判断活的大小。' +
      '回复第一句按 skill“开场声明”告诉用户分诊结果或当前阶段。'
    );
    return;
  }

  const confirm = hit(CONFIRM);
  if (confirm) {
    emit(
      `【包工头触发·确认类】用户消息命中确认类说法「${confirm}」。当前对话不涉及开发改动时忽略本提示；` +
      `涉及时先判断活的大小：${SMALL} → 不加载 skill、不写需求文档，` +
      '回复第一句说“判断为小改动，未启动包工头，直接处理”，然后正常处理；' + UPGRADE +
      '不是小活 → 必须先用 Skill 工具加载 baogongtou（本会话已加载过就不重复加载），按 skill“先分诊”进入速办派工或完整流程，' +
      '不得按自己的理解直接写需求文档或代码，回复第一句按 skill“开场声明”告诉用户当前阶段。'
    );
  }
})();
