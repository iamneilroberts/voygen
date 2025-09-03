# Reducing Browser Screenshot Size in Code Terminal UI

The browser screenshot in the `code` terminal UI (from https://github.com/just-every/code) takes up significant space. Here's how to reduce it:

## Quick Fix: Apply the Patch

1. Clone the code repository:
```bash
git clone https://github.com/just-every/code.git
cd code
```

2. Apply the patch to reduce browser screenshot height by ~60%:
```bash
git apply ../reduce-browser-screenshot.patch
```

3. Build and install:
```bash
./build-fast.sh
```

## What the Patch Does

The browser screenshot height is calculated using an aspect ratio in `codex-rs/tui/src/height_manager.rs` (lines 186-188).

**Original calculation:**
- Uses a 3:4 ratio (0.75) which creates a large screenshot area
- `height = (width * 3) / 4`

**Modified calculation:**
- Uses a 1:3 ratio (0.33) which creates a much smaller screenshot area  
- `height = width / 3`

This reduces the browser screenshot height by approximately 56% while still keeping it visible and useful.

## Alternative Solutions

### Option 1: Disable Browser Screenshot Completely
If you don't need the browser screenshot at all, you can prevent it from showing by modifying `codex-rs/tui/src/chatwidget.rs`:

Look for the `has_browser_screenshot` check around line 1529 and force it to always return false:
```rust
let has_browser_screenshot = false; // Always disable
```

### Option 2: Make it Configurable
You could add an environment variable to control the aspect ratio:

1. In `height_manager.rs`, add:
```rust
let ratio = std::env::var("CODEX_BROWSER_RATIO")
    .ok()
    .and_then(|s| s.parse::<f32>().ok())
    .unwrap_or(0.33); // Default to 1:3 ratio

let number = (inner_cols as f32 * ratio * cw as f32) as u32;
let denom = ch as u32;
```

2. Then set the environment variable:
```bash
export CODEX_BROWSER_RATIO=0.25  # Even smaller
# or
export CODEX_BROWSER_RATIO=0.5   # Medium size
```

## Additional UI Improvements

The `HeightManagerConfig` in `height_manager.rs` also controls:
- `bottom_percent_cap`: Maximum height of the bottom pane (default 35%)
- `hud_quantum`: HUD height rounding (default 2 rows)

You can adjust these in the `Default` implementation (line 34) to further customize the layout.

## Testing

After building with the patch:
1. Run `code` to start the terminal UI
2. Open a browser with the browser tools
3. The screenshot should now take up much less vertical space
4. More of the AI chat conversation will be visible

The reduced screenshot size provides a better balance between seeing the browser state and maximizing the chat area for AI responses.