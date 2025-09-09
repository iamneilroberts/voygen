15) The rendering stack that “just works”

Install in orchestrator
npm i nunjucks html-minifier-terser

orchestrator/src/render/render.ts
import nunjucks from 'nunjucks';
import { minify } from 'html-minifier-terser';
import fs from 'fs/promises';
import path from 'path';

const env = new nunjucks.Environment(
  new nunjucks.FileSystemLoader(path.resolve(process.cwd(), '../templates')),
  { autoescape: true }
);

export async function renderProposal(payload: any) {
  const html = env.render('proposal.njk', payload);
  const min = await minify(html, { collapseWhitespace:true, removeComments:true, minifyCSS:true, minifyJS:true });
  const out = path.resolve(process.cwd(), '../../assets/proposals', `${payload.trip.slug || payload.trip.id}.html`);
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, min, 'utf8');
  return { path: out, html: min };
}


templates/proposal.njk (tiny starter)
<!doctype html><html><head>
<meta charset="utf-8"><title>{{ trip.title }}</title>
<style>
  body{font-family:system-ui,Segoe UI,Arial;margin:0;padding:24px;line-height:1.45;}
  .city{margin:24px 0;padding:16px;border:1px solid #eee;border-radius:12px;}
  .hotel{margin:12px 0;padding:12px;border:1px solid #f1f1f1;border-radius:10px;}
  .price{font-weight:bold}
</style>
</head><body>
<h1>{{ trip.title }}</h1>
<p>Party: {{ trip.party | safe }}</p>

{% for leg in legs %}
  <div class="city">
    <h2>{{ leg.city }} — {{ leg.nights }} nights (arrive {{ leg.arrive }})</h2>
    {% for h in leg.picks or [] %}
      <div class="hotel">
        <h3>{{ h.name }}</h3>
        <p>{{ h.desc }}</p>
        {% if h.lead_price %}<p class="price">From ${{ h.lead_price.amount }}</p>{% endif %}
        {% if h.rates %}<ul>
          {% for r in h.rates %}
            <li>{{ r.label }}{% if r.refundable %} (refundable){% endif %}{% if r.total %} — ${{ r.total }}{% endif %}</li>
          {% endfor %}
        </ul>{% endif %}
      </div>
    {% endfor %}
  </div>
{% endfor %}

</body></html>

