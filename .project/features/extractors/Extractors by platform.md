2) Extractors

We’ll use mcp-chrome evaluate to run page-context JS and return structured JSON.

2A) Delta Vacations / WAD (Trisept)

Goal: Parse room/price/amenity directly from the grid (no extra nav).

Selectors from your snippet: table rows inside .avail-grid-table; hotel name in <h2>…a[href*='HotelInformation']; room links and prices in sibling <td>s.

Paste-ready evaluate (TypeScript-ish JS you pass to mcp-chrome):
(() => {
  const bySel = (el, sel) => Array.from(el.querySelectorAll(sel));
  const hotels = [];
  bySel(document, '.avail-grid-table').forEach(table => {
    const rows = bySel(table, 'tr');
    for (let i=0; i<rows.length-1; i+=2) {
      const head = rows[i];
      const body = rows[i+1];
      const nameA = head.querySelector('h2 a[href*="HotelInformation"]');
      if (!nameA) continue;
      const hotel = {
        name: nameA.textContent.trim(),
        details_link: nameA.getAttribute('onclick') || nameA.href || null,
        location: (head.querySelector('.hotel-location-info')?.textContent || '').trim(),
        rating: (head.querySelector('.hotel-rating-btn .aria-only')?.textContent || '').trim(),
        rooms: []
      };
      bySel(body, '.hotel-avail-room-type-wrap').forEach((rt, idx) => {
        const roomName = rt.textContent.trim().replace(/\s+/g,' ');
        const priceCell = body.querySelectorAll('.hotel-room-col-3 .price .avail-hotel-price strong')[idx];
        const price = priceCell ? priceCell.textContent.replace(/[^\d.]/g,'') : null;
        const addl = body.querySelectorAll('.hotel-room-col-2 .added-value-wrap button')[idx];
        const promo = addl ? addl.textContent.trim() : null;
        hotel.rooms.push({
          room_name: roomName,
          total_price: price ? Number(price) : null,
          promo
        });
      });
      hotels.push(hotel);
    }
  });
  return hotels;
})();

2B) Navitrip / CPMaxx (search page)

Goal: Get per-hotel summary + deeplinks AND (optionally) fetch details without navigating the browser.

Selectors from your snippet: .property.result, name in .property-name, summary in .property-description, amenity icons in .property-rate-amenity, plus a room details page at /HotelEngine/hotelDetails/... and a “Create Hotel Sheet” link with a base64 payload.

Evaluate – listing page:
(() => {
  const cardSel = '.property.result';
  const cards = Array.from(document.querySelectorAll(cardSel));
  return cards.map(c => {
    const name = c.querySelector('.property-name')?.textContent?.trim();
    const desc = c.querySelector('.property-description small')?.textContent?.trim();
    const img = c.querySelector('.property-hotel-image')?.getAttribute('data-background-image')?.split(',')[0];
    const amenities = Array.from(c.querySelectorAll('.property-rate-amenity-name')).map(a => a.textContent.trim());
    const compare = c.querySelector('input.he-hotel-comparison');
    const data = compare ? {
      giata_id: compare.getAttribute('data-giata-id'),
      total_stay: compare.getAttribute('data-total-stay'),
      star_rating: compare.getAttribute('data-star-rating'),
      check_in: compare.getAttribute('data-check-in'),
      check_out: compare.getAttribute('data-check-out')
    } : null;
    const detailsLink = c.querySelector('.select-button')?.getAttribute('href') || null;
    const sheetLink = c.parentElement?.querySelector('a[href*="/HotelSheets/processor/selectRooms/"]')?.getAttribute('href') || null;
    return { name, desc, img, amenities, data, detailsLink, sheetLink };
  });
})();

Decode that base64 “Create Hotel Sheet” (in Node, not the page):
function parseSheetPayload(url: string) {
  // .../selectRooms/<hotelId>/<base64>
  const b64 = decodeURIComponent(url.split('/').pop() || '');
  const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  return json; // has checkin/checkout, lat/lng, rooms[], nights, etc.
}

Fetch room-level details WITHOUT full nav (from listing page):
Because evaluate runs in-page (same origin), you can fetch() the details HTML and parse:
(async () => {
  const links = Array.from(document.querySelectorAll('.select-button'))
    .map(a => a.getAttribute('href'))
    .filter(Boolean)
    .slice(0, 8); // cap for perf

  async function fetchDetail(href) {
    const res = await fetch(href, { credentials: 'include' });
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const rooms = Array.from(doc.querySelectorAll('.hotel-engine-room')).map(r => {
      const rname = r.querySelector('.hotel-engine-room-name')?.textContent.trim();
      const price = r.querySelector('.hotel-engine-room-footer .per-night')?.textContent.replace(/[^\d.]/g,'');
      const total = r.querySelector('.hotel-engine-room-footer .selling-price')?.textContent.replace(/[^\d.]/g,'');
      const rates = Array.from(r.querySelectorAll('.rate-options')).map(ro => {
        const label = ro.querySelector('.rate-option-label')?.textContent.trim();
        const nightly = ro.querySelector('[data-nightly]')?.getAttribute('data-nightly')?.replace(/[^\d.]/g,'');
        const taxes = ro.querySelector('[data-taxes-fees]')?.getAttribute('data-taxes-fees')?.replace(/[^\d.]/g,'');
        const refundable = /Free cancellation|Standard Rate/.test(ro.textContent);
        return { label, nightly: nightly?Number(nightly):null, taxes: taxes?Number(taxes):null, refundable };
      });
      return { room_name: rname, per_night: price?Number(price):null, total: total?Number(total):null, rates };
    });
    return { href, rooms };
  }

  const out = [];
  for (const href of links) {
    try { out.push(await fetchDetail(href)); } catch (e) { out.push({ href, error: String(e) }); }
  }
  return out;
})();

2C) VAX

VAX layouts vary, but typical anchors: table/grid with hotel rows and “View Rooms” inline. Strategy:

Grab hotel rows with name, city, star; parse room blocks under the same row.

Many fields live in data attributes or hidden inputs; enumerate them.

Skeleton evaluate (fill selectors as you encounter them):
(() => {
  const rows = Array.from(document.querySelectorAll('[data-hotel-row], .hotelRow, tr.hotel'));
  return rows.map(r => {
    const name = r.querySelector('a[href*="HotelInformation"]')?.textContent?.trim() ||
                 r.querySelector('[data-hotel-name]')?.textContent?.trim();
    const city = r.querySelector('.city, [data-city]')?.textContent?.trim();
    const stars = r.querySelector('.rating, .stars')?.textContent?.trim();
    const rooms = Array.from(r.querySelectorAll('.room, [data-room]')).map(rr => {
      const roomName = rr.querySelector('.roomName, [data-room-name]')?.textContent?.trim();
      const price = rr.querySelector('.price, [data-price]')?.textContent?.replace(/[^\d.]/g,'');
      const refundable = /Free cancellation|Refundable/i.test(rr.textContent);
      return { roomName, price: price?Number(price):null, refundable };
    });
    return { name, city, stars, rooms };
  });
})();

