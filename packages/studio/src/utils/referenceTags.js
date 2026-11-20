export function tagFor(index) {
  return `@image${index + 1}`;
}

export function buildSuggestions(referenceUrls) {
  if (!Array.isArray(referenceUrls)) return [];
  // Keep this order: the generation gateway resolves @imageN against reference URL order.
  return referenceUrls
    .map((url, index) => ({ tag: tagFor(index), url }))
    .filter(({ url }) => typeof url === "string" && url.length > 0);
}

export function findTags(prompt) {
  if (typeof prompt !== "string") return [];
  return Array.from(prompt.matchAll(/@image\d+\b/g), ([tag]) => tag);
}

export function validateTags(prompt, referenceCount) {
  const count = Number.isFinite(referenceCount)
    ? Math.max(0, Math.floor(referenceCount))
    : 0;
  return [...new Set(findTags(prompt))].filter((tag) => {
    const index = Number(tag.slice("@image".length));
    return index < 1 || index > count;
  });
}
