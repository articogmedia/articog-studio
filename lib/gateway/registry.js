import * as seedance from './providers/seedance';
import * as seedream from './providers/seedream';
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

for (const profile of ['', 'intl-', 'spicy-']) {
  for (const workflow of ['text-to-video', 'image-to-video', 'first-last-frame', 'omni-reference']) {
    for (const resolution of ['', '-480p', '-1080p']) {
      const endpoint = `seedance-2.5-${profile}${workflow}${resolution}`;
      const entry = seedance.getEntry(endpoint);
      if (entry) MODEL_REGISTRY[endpoint] = entry;
    }
  }
}

for (const endpoint of [
  'seedream-5.0',
  'seedream-5.0-edit',
  'seedream-5.0-pro',
  'seedream-5.0-pro-edit',
  'seedream-5.0-flash',
  'seedream-5.0-flash-edit',
]) {
  MODEL_REGISTRY[endpoint] = seedream.getEntry(endpoint);
}

export const PROVIDERS = { seedance, seedream, gemini, openai };

export function getProviderByName(name) {
  return PROVIDERS[name] || null;
}
