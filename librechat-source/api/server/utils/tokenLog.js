const fs = require('fs');
const path = require('path');

function appendTokenUsage(provider, usage = {}) {
  try {
    const logPath = process.env.TOKEN_USAGE_LOG || process.env.MCP_COST_HEADERS_LOG || '/app/logs/token-usage.log';
    const dir = path.dirname(logPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const now = new Date().toISOString();
    const line = JSON.stringify({
      ts: now,
      provider,
      input_tokens: usage.prompt_tokens ?? usage.input_tokens ?? usage.input ?? undefined,
      output_tokens: usage.completion_tokens ?? usage.output_tokens ?? usage.output ?? undefined,
      usage,
    });
    fs.appendFile(logPath, line + '\n', () => {});
  } catch (_) {
    // best-effort logging; ignore errors
  }
}

module.exports = { appendTokenUsage };

