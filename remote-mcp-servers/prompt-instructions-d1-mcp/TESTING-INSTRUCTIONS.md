# Testing the New prompt-instructions-d1 Server

## How to Initialize

Since Claude doesn't automatically know to use the new server, you need to initialize it manually at the start of each conversation.

### Option 1: Direct Initialization (Recommended for Testing)

Start your conversation with:
```
Please use get_instruction('startup-core') from the prompt-instructions-d1 server to load my operating instructions.
```

Or simply:
```
Load startup-core from prompt-instructions-d1
```

### Option 2: Test Specific Instructions

You can test individual instructions directly:
```
Get the 'daily-trip-verification' instruction from prompt-instructions-d1
```

### Option 3: Compare Old vs New

With both servers enabled, you can compare:
```
Show me 'tool-reference' from both prompt-instructions and prompt-instructions-d1
```

## What Happens After Initialization

Once Claude loads the startup-core instruction, it will:
1. Understand the confidence-based loading system
2. Know when to retrieve additional instructions
3. Have the full list of available instructions
4. Include commission tracking awareness

## Testing Checklist

1. **Basic Retrieval**
   - [ ] Load startup-core
   - [ ] List all instructions
   - [ ] Retrieve a specific instruction

2. **New Features**
   - [ ] Test commission analysis with trip-completeness-check
   - [ ] Try the client-interview-mode
   - [ ] Test image-capture-optimization guidance
   - [ ] Verify daily-trip-verification process

3. **Confidence-Based Loading**
   - [ ] Observe when Claude retrieves instructions
   - [ ] Test high/medium/low confidence scenarios

## Transition Strategy

1. **Phase 1**: Test with both servers enabled
2. **Phase 2**: Update workflows to use new server
3. **Phase 3**: Disable old server when confident

## Quick Test Commands

```
# See what's available
list_instructions() from prompt-instructions-d1

# Get specific instruction
get_instruction('commission-targets') from prompt-instructions-d1

# Test commission config
Can you query the commission_config table?
```

## Notes

- The new server has all the instructions from the old one, plus enhancements
- Commission tracking is built into multiple instructions
- The confidence-based system reduces unnecessary instruction loading
- All instructions reference each other appropriately