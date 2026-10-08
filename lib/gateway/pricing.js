const IMAGE_PRICES = {
  'nano-banana-2': null, 'nano-banana-2-edit': null,
  'nano-banana-pro': null, 'nano-banana-pro-edit': null,
  'gpt-image-2.5-flare-text-to-image': null, 'gpt-image-2.5-flare-image-to-image': null,
  'gpt-image-2.5-sunburst-text-to-image': null, 'gpt-image-2.5-sunburst-image-to-image': null,
};

// Seedance: credits per second of video, by resolution
const VIDEO_PER_SECOND = {
  'dreamina-seedance-2-5-260628': { '480p': null, '720p': null, '1080p': null },
  'dreamina-seedance-2-0-260128': { '480p': null, '720p': null, '1080p': null, '4k': null },
};

export function priceFor(endpoint, entry, input) {
  let price;
  if (entry.provider === 'seedance') {
    const resolution = String(input.resolution || '720p').toLowerCase();
    const perSecond = VIDEO_PER_SECOND[entry.model]?.[resolution];
    price = perSecond == null ? null : Math.ceil(perSecond * (Number(input.duration) || 5));
  } else {
    price = IMAGE_PRICES[endpoint];
  }
  if (price == null) throw new Error(`No price set for ${endpoint}`);
  return price;
}
