/**
 * @deprecated Prefer `./ai/model`. Kept so old imports keep resolving.
 */
export {
  resolveAiModel as resolveOpenRouterModel,
  resolveAiModelWithSource as resolveOpenRouterModelWithSource,
  getAiModelDiagnostics as getOpenRouterModelDiagnostics,
} from './ai/model';

export type {
  AiModelSource as OpenRouterModelSource,
  AiModelResolution as OpenRouterModelResolution,
} from './ai/model';
