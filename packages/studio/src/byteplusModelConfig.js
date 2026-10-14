export const BYTEPLUS_MAX_REFERENCE_IMAGES = Object.freeze({
  "dreamina-seedance-2-5-260628": 30,
  "dreamina-seedance-2-0-260128": 9,
});

export const DEFAULT_BYTEPLUS_MAX_REFERENCE_IMAGES = 9;

export function getBytePlusMaxReferenceImages(modelId) {
  return BYTEPLUS_MAX_REFERENCE_IMAGES[modelId] || DEFAULT_BYTEPLUS_MAX_REFERENCE_IMAGES;
}