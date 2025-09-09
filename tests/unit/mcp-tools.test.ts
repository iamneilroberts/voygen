import { describe, it, expect } from 'vitest';
import * as shared from '../../mcp-local-servers/mcp-chrome/packages/shared/dist/index.js';

describe('mcp shared tool schemas', () => {
  it('includes chrome extractor tools', () => {
    const names = shared.TOOL_SCHEMAS.map((t: any) => t.name);
    expect(names).toContain('chrome_extract_hotels');
    expect(names).toContain('chrome_parse_travel_facts');
  });
  it('includes orchestrator tools', () => {
    const names = shared.TOOL_SCHEMAS.map((t: any) => t.name);
    expect(names).toContain('extract_hotels');
    expect(names).toContain('extract_room_rates');
  });
});

