import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { ModelClient, ModelRequest, ModelResponse } from './harness.js';

/**
 * Claude through the Anthropic API, using structured outputs so every reply
 * is parsed against the agent's schema. Server-side refusal fallbacks are on
 * (`fallbacks: "default"`), so a safety-classifier decline is retried on the
 * model Anthropic recommends for that category; if the whole chain declines,
 * the harness sees `stop_reason: "refusal"` and reports it.
 */
export class AnthropicModelClient implements ModelClient {
  readonly name = 'anthropic';
  private readonly client: Anthropic;

  constructor(opts: { apiKey?: string; maxRetries?: number } = {}) {
    this.client = new Anthropic({ apiKey: opts.apiKey, maxRetries: opts.maxRetries ?? 2 });
  }

  async complete<T>(req: ModelRequest<T>): Promise<ModelResponse<T>> {
    const msg = await this.client.beta.messages.parse(
      {
        model: req.model,
        max_tokens: req.maxTokens,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: req.system,
        messages: [{ role: 'user', content: req.user }],
        output_config: { effort: req.effort, format: betaZodOutputFormat(req.schema) },
      },
      { timeout: req.timeoutMs },
    );
    return {
      output: msg.stop_reason === 'refusal' ? null : ((msg.parsed_output as T | null) ?? null),
      stopReason: msg.stop_reason ?? null,
      model: msg.model,
      usage: { inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens },
      requestId: (msg as { _request_id?: string | null })._request_id ?? undefined,
    };
  }
}
