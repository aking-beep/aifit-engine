import type { ModelClient, ModelRequest, ModelResponse } from './harness.js';

/**
 * A fake model for tests and offline evals: answers each agent from a script.
 * It records every request so tests can assert what the model was shown.
 */
export class ScriptedModelClient implements ModelClient {
  readonly name = 'scripted';
  readonly requests: ModelRequest<unknown>[] = [];
  private readonly reply: (req: ModelRequest<unknown>) => unknown | Promise<unknown>;
  private readonly stopReason: string;

  constructor(reply: (req: ModelRequest<unknown>) => unknown | Promise<unknown>, opts: { stopReason?: string } = {}) {
    this.reply = reply;
    this.stopReason = opts.stopReason ?? 'end_turn';
  }

  async complete<T>(req: ModelRequest<T>): Promise<ModelResponse<T>> {
    this.requests.push(req as ModelRequest<unknown>);
    const raw = await this.reply(req as ModelRequest<unknown>);
    // Mirror the SDK: a reply that does not parse comes back as null output.
    const parsed = req.schema.safeParse(raw);
    return { output: parsed.success ? parsed.data : null, stopReason: this.stopReason, model: req.model, usage: { inputTokens: 0, outputTokens: 0 } };
  }
}
