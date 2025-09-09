import {
  ExtractResult,
  ParserResult,
  HotelDTO,
  HotelRow,
  TravelFacts,
  PageType,
} from '../extractors/types';
import { SMART_RESULTS_EXTRACTOR_JS, GENERIC_TRAVEL_PARSER_JS } from '../extractors/scripts';
import { gunzipNdjson, gunzipToJson } from './inflate';
import { mapRowToDTO } from './hotel-extract-helper';

export type Injector = (scriptBody: string, args?: Record<string, any>) => Promise<any>;

export type SmartExtractArgs = {
  pageTypeHint?: PageType;
  maxRows?: number;
  domSelector?: string;
};

export type GenericFactsArgs = {
  hint?: string;
  maxChars?: number;
  preferKind?: string[];
};

export type SmartExtractOutput = {
  raw: ExtractResult;
  rows?: HotelRow[];
  dtos?: HotelDTO[];
};

export type GenericFactsOutput = {
  raw: ParserResult;
  facts?: TravelFacts;
};

// Executes the Smart Results Extractor in the active page via provided injector
export async function injectSmartResults(
  injector: Injector,
  args: SmartExtractArgs = {}
): Promise<SmartExtractOutput> {
  const raw = (await injector(SMART_RESULTS_EXTRACTOR_JS, args)) as ExtractResult;
  if (!raw?.ok) return { raw };
  if (!raw.ndjson_gz_base64) return { raw };
  const rows = await gunzipNdjson<HotelRow>(raw.ndjson_gz_base64);
  const dtos = rows.map(mapRowToDTO).filter(Boolean) as HotelDTO[];
  return { raw, rows, dtos };
}

// Executes the Generic Travel Content Parser via provided injector
export async function injectGenericFacts(
  injector: Injector,
  args: GenericFactsArgs = {}
): Promise<GenericFactsOutput> {
  const raw = (await injector(GENERIC_TRAVEL_PARSER_JS, args)) as ParserResult;
  if (!raw?.ok) return { raw };
  if (!raw.facts_gz_base64) return { raw };
  const facts = await gunzipToJson<TravelFacts>(raw.facts_gz_base64);
  return { raw, facts };
}

// Example injector adapter for an MCP Chrome tool client
// Callers should provide a function that knows how to call their MCP server.
// Below is a typed shape to guide implementation on the calling side:
export type ChromeInjectTool = (input: {
  scriptBody: string;
  args?: Record<string, any>;
  // optional fields like tabId, frameId, timeoutMs can be supported by the caller
}) => Promise<any>;

export function makeChromeInjectorAdapter(tool: ChromeInjectTool): Injector {
  return async (scriptBody: string, args?: Record<string, any>) => {
    return tool({ scriptBody, args });
  };
}

