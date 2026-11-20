// Placeholder until server pricing (Phase 8 pricing.js) is live; keep numbers in sync.
const IMAGE_PRICES = Object.freeze({
  "nano-banana": null,
  "flux-dev": null,
  "nano-banana-pro": null,
  "nano-banana-pro-edit": null,
});

const VIDEO_PER_SECOND = Object.freeze({
  "seedance-lite-t2v": Object.freeze({
    "480p": null,
    "720p": null,
    "1080p": null,
  }),
  "seedance-pro-t2v": Object.freeze({
    "480p": null,
    "720p": null,
    "1080p": null,
  }),
  "seedance-pro-t2v-fast": Object.freeze({
    "480p": null,
    "720p": null,
    "1080p": null,
  }),
  "seedance-lite-i2v": Object.freeze({
    "480p": null,
    "720p": null,
    "1080p": null,
  }),
  "seedance-pro-i2v": Object.freeze({
    "480p": null,
    "720p": null,
    "1080p": null,
  }),
  "seedance-pro-i2v-fast": Object.freeze({
    "480p": null,
    "720p": null,
    "1080p": null,
  }),
});

export function estimateCredits(modelId, settings = {}) {
  const batchSize = Number(settings.batchSize ?? 1);
  if (!Number.isFinite(batchSize) || batchSize < 1) return null;

  if (Object.hasOwn(IMAGE_PRICES, modelId)) {
    const price = IMAGE_PRICES[modelId];
    return typeof price === "number" ? price * batchSize : null;
  }

  const resolution = settings.resolution || settings.quality;
  const pricePerSecond = VIDEO_PER_SECOND[modelId]?.[resolution];
  const duration = Number(settings.duration);
  if (
    typeof pricePerSecond !== "number"
    || !Number.isFinite(duration)
    || duration <= 0
  ) {
    return null;
  }
  return pricePerSecond * duration * batchSize;
}
