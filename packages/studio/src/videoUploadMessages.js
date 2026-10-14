export function reportUnavailableReferenceUpload(
  mediaType,
  family,
  setImageInputMessage,
  showError,
) {
  if (mediaType === "image") {
    if (family?.variants.i2v?.length) {
      const message = 'Switch the mode from "From prompt" to "Animate image", "Start & end frames" or "Use references" to add images.';
      setImageInputMessage(message);
      showError(message);
    } else {
      setImageInputMessage(`${family?.name || "This model"} doesn't support image input.`);
    }
    return;
  }

  showError(`${family.name} does not support ${mediaType} references.`);
}