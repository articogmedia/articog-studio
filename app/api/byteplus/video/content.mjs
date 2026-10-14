function isValidImageUrl(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  const url = value.trim();
  if (/^data:image\/[a-z0-9.+-]+(?:;[^,]*)?,[\s\S]+$/i.test(url)) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

export function buildBytePlusContent({ prompt, imageUrls, maxImages = 9 }) {
  if (!Array.isArray(imageUrls)) {
    throw new TypeError("image_urls must be an array of image URLs.");
  }
  if (imageUrls.length > maxImages) {
    throw new RangeError(`This model accepts at most ${maxImages} reference images.`);
  }
  if (imageUrls.some((url) => !isValidImageUrl(url))) {
    throw new TypeError("Each image must be an HTTPS URL or a data:image/ URL.");
  }

  const urls = imageUrls.map((url) => url.trim());
  const content = [{ type: "text", text: prompt }];
  const extraBody = {};
  let ratioOverride = null;
  if (urls.length === 1) {
    content.push({ type: "image_url", image_url: { url: urls[0] }, role: "first_frame" });
    ratioOverride = "adaptive";
  } else if (urls.length > 1) {
    content.push(...urls.map((url) => ({
      type: "image_url",
      image_url: { url },
      role: "reference_image",
    })));
    extraBody.omni_reference_task_type = "reference";
  }
  return { content, extraBody, ratioOverride };
}