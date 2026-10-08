import * as seedance from './providers/seedance';
import * as gemini from './providers/gemini';
import * as openai from './providers/openai';

export const MODEL_REGISTRY = {
  'nano-banana-2': { provider: 'gemini', model: 'gemini-3.1-flash-image' },
  'nano-banana-2-edit': { provider: 'gemini', model: 'gemini-3.1-flash-image' },
  'nano-banana-pro': { provider: 'gemini', model: 'gemini-3-pro-image' },
  'nano-banana-pro-edit': { provider: 'gemini', model: 'gemini-3-pro-image' },
  'gpt-image-2.5-flare-text-to-image': { provider: 'openai', model: 'gpt-image-2.5-flare' },
  'gpt-image-2.5-flare-image-to-image': { provider: 'openai', model: 'gpt-image-2.5-flare' },
  'gpt-image-2.5-sunburst-text-to-image': { provider: 'openai', model: 'gpt-image-2.5-sunburst' },
  'gpt-image-2.5-sunburst-image-to-image': { provider: 'openai', model: 'gpt-image-2.5-sunburst' },
  'seedance-2.5-text-to-video': { provider: 'seedance', model: 'dreamina-seedance-2-5-260628' },
  'seedance-2.5-image-to-video': { provider: 'seedance', model: 'dreamina-seedance-2-5-260628', imageRole: 'first_frame' },
  'seedance-v2.0-t2v': { provider: 'seedance', model: 'dreamina-seedance-2-0-260128' },
  'seedance-2-first-last-frame': { provider: 'seedance', model: 'dreamina-seedance-2-0-260128', imageRole: 'first_last' },
  'seedance-2.0-omni-reference': { provider: 'seedance', model: 'dreamina-seedance-2-0-260128', imageRole: 'reference_image' },
};

export const PROVIDERS = { seedance, gemini, openai };

export function getProviderByName(name) {
  return PROVIDERS[name] || null;
}
