<<<<<<< HEAD
# cc-workflow-evolution

Claude Code 扩展包 - 对话历史自动总结（SiliconFlow 验证版）

## 功能

- 自动解析 Claude Code 会话历史
- 调用 SiliconFlow API 生成结构化总结
- 版本化存储，支持历史回溯
- 手动触发（`/workflow`）+ 自动触发（每 10 次工具调用）

## 安装

```bash
cd cc-workflow-evolution
node install.js
```

## 配置

在 `~/.claude/settings.json` 的 `env` 中添加：

```json
{
  "env": {
    "SILICONFLOW_API_KEY": "sk-xxx",
    "SILICONFLOW_BASE_URL": "https://api.siliconflow.cn/v1",
    "SILICONFLOW_MODEL": "Qwen/Qwen2.5-7B-Instruct",
    "WORKFLOW_THRESHOLD": "10",
    "WORKFLOW_MIN_NEW_MESSAGES": "3",
    "WORKFLOW_MIN_INTERVAL": "300",
    "SUMMARY_LANGUAGE": "zh-CN"
  }
}
```

## 使用

### 手动触发

在 Claude Code 中输入：

```
/workflow
```

### 自动触发

每 15 次工具调用后自动在后台生成总结。

### 查看结果

```
{project_root}/.claude-workflows/
├── summary-latest.md          # 最新总结（Markdown）
├── summary-latest.json        # 最新总结（JSON + 元数据）
├── summary-v1.json            # 版本存档
├── summary-v2.json
├── summary-history.jsonl      # 生成历史日志
└── state/
    ├── counter.txt            # 工具调用计数器
    └── last-snapshot.json     # 上次快照（用于 diff）
```

## 卸载

```bash
node uninstall.js
```

## 验证版说明

本版本用于验证链路完整性，使用 SiliconFlow API 生成对话总结。未来可替换为黑盒 Workflow 生成接口，其余链路（session 解析、diff、counter、版本化、Hook）保持不变。

## 链路验证

查看完整验证报告：[VERIFICATION_REPORT.md](./VERIFICATION_REPORT.md)

快速演示脚本：
```bash
cd cc-workflow-evolution
bash demo.sh
```

## 开发文档

详见 `cc-workflow-evolution-summary-validation-design.md`
=======
# cc-workflow-evolution
>>>>>>> 188b572ebc3f4ac0984969aa812c5f5acf48ddc7
