/** OpenRouter slug for GPT-5.6 Luna. */
const FALLBACK_MODEL = 'openai/gpt-5.6-luna';

export type AiModelSource =
  | 'openrouter_model_name'
  | 'OPENROUTER_MODEL_NAME'
  | 'request'
  | 'fallback';

export type AiModelResolution = {
  model: string;
  source: AiModelSource;
};

function readEnvModel(): AiModelResolution | null {
  const lower = process.env.openrouter_model_name?.trim();
  if (lower) return { model: lower, source: 'openrouter_model_name' };

  const upper = process.env.OPENROUTER_MODEL_NAME?.trim();
  if (upper) return { model: upper, source: 'OPENROUTER_MODEL_NAME' };

  return null;
}

/** Server env wins, then optional request body, then Luna via OpenRouter. */
export function resolveAiModelWithSource(
  requestModel?: string | null
): AiModelResolution {
  const fromEnv = readEnvModel();
  if (fromEnv) return fromEnv;

  const trimmed = requestModel?.trim();
  if (trimmed) return { model: trimmed, source: 'request' };

  return { model: FALLBACK_MODEL, source: 'fallback' };
}

export function resolveAiModel(requestModel?: string | null): string {
  return resolveAiModelWithSource(requestModel).model;
}

export function getAiModelDiagnostics(requestModel?: string | null) {
  const server = resolveAiModelWithSource(undefined);
  const withRequest = resolveAiModelWithSource(requestModel);

  return {
    model: server.model,
    source: server.source,
    priority:
      'openrouter_model_name → OPENROUTER_MODEL_NAME → request body model → fallback',
    env: {
      openrouter_model_name: Boolean(process.env.openrouter_model_name?.trim()),
      OPENROUTER_MODEL_NAME: Boolean(process.env.OPENROUTER_MODEL_NAME?.trim()),
      OPENROUTER_API_KEY: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
    },
    fallbackModel: FALLBACK_MODEL,
    ifClientSendsModel: {
      model: withRequest.model,
      source: withRequest.source,
      note:
        'When server env is set, client-sent model is ignored. Shown only for debugging.',
    },
  };
}
