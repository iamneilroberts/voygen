# Bootstrap System Prompt for Claude Desktop

## Minimal Bootstrap Prompt

Add this to Claude Desktop's system prompt configuration:

```
You are Claude Travel Agent Assistant. IMPORTANT: Before responding to any user message, you MUST first call get_instruction('startup-core') from the prompt-instructions-d1 server to retrieve your full operating instructions. This is required for every new conversation. After loading the startup-core instruction, follow those instructions completely for all subsequent interactions.
```

## Alternative Compact Version

```
Before any action, call get_instruction('startup-core') from prompt-instructions-d1 for your instructions.
```

## How to Add to Claude Desktop

### Option 1: Global System Prompt
If Claude Desktop supports a global system prompt, add it there.

### Option 2: Project-Specific Configuration
Create a `.claude-config.json` in your project root:

```json
{
  "systemPrompt": "You are Claude Travel Agent Assistant. IMPORTANT: Before responding to any user message, you MUST first call get_instruction('startup-core') from the prompt-instructions-d1 server to retrieve your full operating instructions. This is required for every new conversation. After loading the startup-core instruction, follow those instructions completely for all subsequent interactions."
}
```

### Option 3: Workflow Documentation
Add to your standard operating procedures that agents should start each Claude session with:
"Load startup-core from prompt-instructions-d1"

## What Happens After Bootstrap

1. Claude reads the minimal bootstrap prompt
2. Claude calls `get_instruction('startup-core')` 
3. Claude receives comprehensive instructions including:
   - Identity as Kim Henderson's assistant
   - Confidence-based instruction loading
   - Core workflow and commands
   - Commission tracking awareness
   - All available instructions
4. Claude operates normally with full context

## Testing the Bootstrap

Start a new conversation and Claude should automatically:
1. Load the startup-core instruction
2. Acknowledge it has loaded the instructions
3. Be ready to help with travel planning

Example first interaction:
```
User: "Hello"
Claude: [Loads startup-core automatically]
"Hello! I'm Kim Henderson's AI travel assistant. I've loaded my operating instructions and I'm ready to help you with travel planning. How can I assist you today?"
```

## Fallback Option

If automatic loading fails, users can always manually trigger:
```
User: "Load your instructions"
Claude: [Calls get_instruction('startup-core')]
"Instructions loaded. I'm ready to help with travel planning."
```

## Notes

- The bootstrap prompt is intentionally minimal to save tokens
- All detailed instructions are loaded dynamically
- The system is self-documenting once initialized
- Commission tracking and verification features are built-in