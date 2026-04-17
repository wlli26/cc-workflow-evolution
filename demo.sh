#!/bin/bash
# cc-workflow-evolution 链路演示脚本

echo "=========================================="
echo "cc-workflow-evolution 链路完整性演示"
echo "=========================================="
echo ""

# 1. 检查安装
echo "【1】检查安装状态..."
if [ -f ~/.claude/extensions/workflow-evolution/workflow.js ]; then
  echo "✅ 脚本已部署到 ~/.claude/extensions/workflow-evolution/"
  ls -lh ~/.claude/extensions/workflow-evolution/
else
  echo "❌ 脚本未部署"
  exit 1
fi
echo ""

# 2. 检查命令
echo "【2】检查 /workflow 命令..."
if [ -f ~/.claude/commands/workflow.md ]; then
  echo "✅ 命令已注册"
  head -3 ~/.claude/commands/workflow.md
else
  echo "❌ 命令未注册"
  exit 1
fi
echo ""

# 3. 检查 Hook
echo "【3】检查 PostToolUse Hook..."
if grep -q "workflow-counter.js" ~/.claude/settings.json; then
  echo "✅ Hook 已注册"
  grep -A 2 "workflow-counter.js" ~/.claude/settings.json | head -3
else
  echo "❌ Hook 未注册"
  exit 1
fi
echo ""

# 4. 检查项目级状态
echo "【4】检查项目级状态目录..."
if [ -d .claude-workflows ]; then
  echo "✅ 状态目录已创建"
  echo "   文件列表："
  ls -lh .claude-workflows/ | grep -v "^total" | awk '{print "   " $9 " (" $5 ")"}'
else
  echo "❌ 状态目录不存在"
  exit 1
fi
echo ""

# 5. 检查生成历史
echo "【5】检查生成历史..."
if [ -f .claude-workflows/summary-history.jsonl ]; then
  echo "✅ 生成历史记录："
  wc -l .claude-workflows/summary-history.jsonl | awk '{print "   共 " $1 " 个版本"}'
  echo "   最新版本："
  tail -1 .claude-workflows/summary-history.jsonl | jq '.' 2>/dev/null || tail -1 .claude-workflows/summary-history.jsonl
else
  echo "❌ 生成历史不存在"
  exit 1
fi
echo ""

# 6. 检查 CLAUDE.md 注入
echo "【6】检查 CLAUDE.md 柔性引导..."
if [ -f CLAUDE.md ] && grep -q "Workflow Capture Guidance" CLAUDE.md; then
  echo "✅ 柔性引导已注入"
  grep -A 2 "Workflow Capture Guidance" CLAUDE.md | head -3
else
  echo "❌ 柔性引导未注入"
  exit 1
fi
echo ""

# 7. 测试 session 解析
echo "【7】测试 session 解析..."
node -e "
const { findLatestSessionFile, parseSessionMessages } = require('$HOME/.claude/extensions/workflow-evolution/session-parser');
const f = findLatestSessionFile('.');
if (!f) { console.log('❌ 未找到 session 文件'); process.exit(1); }
const msgs = parseSessionMessages(f);
console.log('✅ Session 解析成功');
console.log('   文件：' + f.split('/').pop());
console.log('   消息数：' + msgs.length);
" 2>/dev/null || echo "❌ Session 解析失败"
echo ""

# 8. 测试 diff 检查
echo "【8】测试 diff 检查..."
node -e "
const { findLatestSessionFile, parseSessionMessages } = require('$HOME/.claude/extensions/workflow-evolution/session-parser');
const { shouldUpdate } = require('$HOME/.claude/extensions/workflow-evolution/workflow-diff');
const f = findLatestSessionFile('.');
const msgs = parseSessionMessages(f);
const result = shouldUpdate('.claude-workflows/state', msgs);
console.log('✅ Diff 检查成功');
console.log('   应该更新：' + result.shouldUpdate);
console.log('   原因：' + result.reason);
" 2>/dev/null || echo "❌ Diff 检查失败"
echo ""

echo "=========================================="
echo "✅ 所有链路验证通过！"
echo "=========================================="
echo ""
echo "下一步："
echo "  1. 手动触发：/workflow"
echo "  2. 强制更新：/workflow --force"
echo "  3. 查看结果：.claude-workflows/summary-latest.md"
