# Generate or Update Conversation Summary

Analyze the current session history and generate a structured summary via SiliconFlow API.

## Instructions

Run this command using the Bash tool:

```bash
node ~/.claude/extensions/workflow-evolution/workflow.js --force
```

The script parses conversation history, calls SiliconFlow to summarize, and writes results to `.claude-workflows/` in the current project directory.
Report the output file paths to the user. Do NOT read or summarize the content.
