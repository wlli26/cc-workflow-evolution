## Workflow Capture Guidance

This project uses `cc-workflow-evolution` to capture and summarize conversation history.

### When to suggest /workflow

- When you complete a complex task (multi-file refactoring, debugging a hard problem,
  designing an architecture), consider suggesting to the user:
  "This looks like a reusable pattern — run /workflow to capture it."

- When you notice `.claude-workflows/workflow-latest.json` exists but may be outdated
  based on significant new context in the current conversation, suggest running /workflow
  to update it.

### How it works

- `/workflow` — manually trigger a conversation summary
- `/workflow --force` — force regenerate (skip diff checks)
- Auto-trigger: every 15 tool calls, a background summary is generated
- Results are saved in `.claude-workflows/`
