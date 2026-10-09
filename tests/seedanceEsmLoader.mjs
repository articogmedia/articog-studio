import { readFile } from 'node:fs/promises';

const MODULE_PATHS = ['/lib/gateway/', '/packages/studio/src/'];

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (
      error.code !== 'ERR_MODULE_NOT_FOUND' ||
      !specifier.startsWith('.') ||
      /\.[^/]+$/.test(specifier)
    ) {
      throw error;
    }
    return nextResolve(`${specifier}.js`, context);
  }
}

export async function load(url, context, nextLoad) {
  const pathname = new URL(url).pathname;
  if (url.endsWith('.js') && MODULE_PATHS.some((modulePath) => pathname.includes(modulePath))) {
    return {
      format: 'module',
      source: await readFile(new URL(url), 'utf8'),
      shortCircuit: true,
    };
  }
  return nextLoad(url, context);
}