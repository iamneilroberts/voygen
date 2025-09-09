import { HotelDTO, HotelRow } from '../extractors/types';

export function toNumber(x: unknown): number | undefined {
  if (x == null) return undefined;
  const n = typeof x === 'number' ? x : Number(String(x).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

export function mapRowToDTO(row: HotelRow): HotelDTO | null {
  const id = row.id || row.detail_url || row.name;
  const name = row.name;
  if (!id || !name) return null;
  return {
    id: String(id),
    name: String(name),
    brand: row.brand,
    lat: row.lat,
    lon: row.lon,
    address: row.address,
    starRating: toNumber(row.star_rating),
    reviewScore: toNumber(row.review_score),
    priceText: row.price_text,
    currency: row.currency,
    taxesFeesText: row.taxes_fees_text,
    cancelText: row.cancel_text,
    refundable: row.refundable,
    packageType: row.package_type,
    image: row.image,
    detailUrl: row.detail_url,
  };
}

