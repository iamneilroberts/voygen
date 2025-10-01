const { Tool } = require('@langchain/core/tools');
const { z } = require('zod');

/**
 * render_trip_status
 * A lightweight structured tool that renders a compact trip status summary.
 * Returns:
 *  - markdown: A concise text block suitable to prepend to replies
 *  - image_data_url: An inline SVG data URL that can be embedded by the assistant
 */
class RenderTripStatus extends Tool {
  constructor(fields = {}) {
    super(fields);
    this.name = 'render_trip_status';
    this.description =
      'Render a compact status card for the active trip (trip name, cost, percent complete, phase, dates, and next steps). Returns markdown and an inline SVG data URL.';
    this.schema = z.object({
      trip_name: z.string().min(1),
      percent_complete: z.number().min(0).max(100).default(0),
      phase: z.string().min(1),
      dates: z.string().min(1),
      cost: z.union([z.string(), z.number()]).optional(),
      next_steps: z.array(z.string()).optional(),
      theme: z
        .object({
          primary: z.string().optional(),
          accent: z.string().optional(),
          text: z.string().optional(),
          background: z.string().optional(),
        })
        .optional(),
    });
  }

  async _call(input) {
    const {
      trip_name,
      percent_complete = 0,
      phase,
      dates,
      cost,
      next_steps = [],
      theme = {},
    } = input || {};

    const pct = Math.max(0, Math.min(100, Number(percent_complete) || 0));

    const colors = {
      primary: theme.primary || '#2563eb',
      accent: theme.accent || '#059669',
      text: theme.text || '#0f172a',
      background: theme.background || '#ffffff',
      progressBg: '#e5e7eb',
    };

    const md = [
      `Trip: ${trip_name}`,
      cost != null ? `Cost: ${String(cost)}` : null,
      `Progress: ${pct}% — Phase: ${phase}`,
      `Dates: ${dates}`,
      next_steps?.length ? `Next Steps: ${next_steps.join('; ')}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    // Basic, safe inline SVG (no external resources). Keep it compact.
    const width = 720;
    const height = 180;
    const barWidth = Math.max(0, Math.min(width - 40, Math.round(((width - 40) * pct) / 100)));
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect x="0" y="0" width="${width}" height="${height}" rx="12" fill="${colors.background}" stroke="${colors.primary}"/>
  <text x="20" y="40" font-family="Inter, Arial, sans-serif" font-size="20" fill="${colors.text}" font-weight="700">${esc(
      trip_name,
    )}</text>
  <text x="20" y="70" font-family="Inter, Arial, sans-serif" font-size="14" fill="${colors.text}">
    ${esc(phase)} • ${pct}% • ${esc(dates)}${cost != null ? ` • ${esc(String(cost))}` : ''}
  </text>
  <rect x="20" y="95" width="${width - 40}" height="14" rx="7" fill="${colors.progressBg}"/>
  <rect x="20" y="95" width="${barWidth}" height="14" rx="7" fill="${colors.accent}"/>
  <text x="${width - 60}" y="106" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="12" fill="${colors.text}">${pct}%</text>
  <text x="20" y="130" font-family="Inter, Arial, sans-serif" font-size="13" fill="${colors.text}" opacity="0.9">Next Steps:</text>
  <text x="20" y="150" font-family="Inter, Arial, sans-serif" font-size="13" fill="${colors.text}" opacity="0.9">${esc(
      next_steps && next_steps.length ? next_steps.join(' • ') : '—',
    )}</text>
  <title>Trip Status</title>
  <desc>Compact trip status card with progress bar and next steps</desc>
</svg>`;

    const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    return JSON.stringify({ markdown: md, image_data_url: dataUrl });
  }
}

module.exports = RenderTripStatus;

