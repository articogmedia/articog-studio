import { createDevSeedreamTestHandler, isDevSeedreamTestEnabled } from '@/lib/gateway/devSeedreamTest';
import { start } from '@/lib/gateway/providers/seedream';

const ENDPOINT = 'seedream-5.0-pro';

export const runtime = 'nodejs';

const handleSeedreamTest = createDevSeedreamTestHandler({
  isEnabled: () => isDevSeedreamTestEnabled(),
  hasApiKey: () => Boolean(process.env.ARK_API_KEY),
  generate: (input) => start(input, { endpoint: ENDPOINT }),
});

export const POST = handleSeedreamTest;