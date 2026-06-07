const FALLBACK_MODEL = 'arcee-ai/trinity-large-preview:free';

export type OpenRouterModelSource =
  | 'openrouter_model_name'
  | 'OPENROUTER_MODEL_NAME'
  | 'request'
  | 'fallback';

export type OpenRouterModelResolution = {
  model: string;
  source: OpenRouterModelSource;
};

function readEnvModel(): OpenRouterModelResolution | null {
  const lower = process.env.openrouter_model_name?.trim();
  if (lower) return { model: lower, source: 'openrouter_model_name' };

  const upper = process.env.OPENROUTER_MODEL_NAME?.trim();
  if (upper) return { model: upper, source: 'OPENROUTER_MODEL_NAME' };

  return null;
}

/** Server env wins, then optional request body, then fallback. */
export function resolveOpenRouterModelWithSource(
  requestModel?: string | null
): OpenRouterModelResolution {
  const fromEnv = readEnvModel();
  if (fromEnv) return fromEnv;

  const trimmed = requestModel?.trim();
  if (trimmed) return { model: trimmed, source: 'request' };

  return { model: FALLBACK_MODEL, source: 'fallback' };
}

export function resolveOpenRouterModel(requestModel?: string | null): string {
  return resolveOpenRouterModelWithSource(requestModel).model;
}

export function getOpenRouterModelDiagnostics(requestModel?: string | null) {
  const server = resolveOpenRouterModelWithSource(undefined);
  const withRequest = resolveOpenRouterModelWithSource(requestModel);

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
