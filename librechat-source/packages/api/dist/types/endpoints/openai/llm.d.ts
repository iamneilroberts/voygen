import type * as t from '~/types';
export declare const knownOpenAIParams: Set<string>;
/**
 * Generates configuration options for creating a language model (LLM) instance.
 * @param apiKey - The API key for authentication.
 * @param options - Additional options for configuring the LLM.
 * @param endpoint - The endpoint name
 * @returns Configuration options for creating an LLM instance.
 */
export declare function getOpenAIConfig(apiKey: string, options?: t.OpenAIConfigOptions, endpoint?: string | null): t.LLMConfigResult;
//# sourceMappingURL=llm.d.ts.map