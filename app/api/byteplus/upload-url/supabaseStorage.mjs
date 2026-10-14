import { randomUUID } from "node:crypto";

export const MAX_REFERENCE_IMAGE_BYTES = 29_000_000;
const MAX_BUCKET_FILE_SIZE_BYTES = 30 * 1024 * 1024;
export const SIGNED_READ_URL_TTL_SECONDS = 24 * 60 * 60;

const IMAGE_TYPES = Object.freeze({
  "image/jpeg": { extension: "jpg", signature: (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  "image/png": { extension: "png", signature: (bytes) => bytes.subarray(0, 8).join(",") === "137,80,78,71,13,10,26,10" },
  "image/webp": { extension: "webp", signature: (bytes) => bytes.subarray(0, 4).join(",") === "82,73,70,70" && bytes.subarray(8, 12).join(",") === "87,69,66,80" },
});

export class StorageUploadError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function getStorageConfig({ supabaseUrl, serviceRoleKey, bucket }) {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new StorageUploadError(
      "BytePlus image storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      503,
    );
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(supabaseUrl);
  } catch {
    throw new StorageUploadError("SUPABASE_URL must be a valid HTTPS URL.", 503);
  }
  if (parsedUrl.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(parsedUrl.hostname)) {
    throw new StorageUploadError("SUPABASE_URL must use HTTPS.", 503);
  }
  const bucketId = bucket || "byteplus-images";
  if (!/^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$/.test(bucketId)) {
    throw new StorageUploadError("BYTEPLUS_REFERENCE_BUCKET is invalid.", 503);
  }
  return { baseUrl: parsedUrl.origin, serviceRoleKey, bucket: bucketId };
}

function storageHeaders(serviceRoleKey, json = false) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

function objectPathUrl(baseUrl, bucket, path, endpoint = "") {
  const safeBucket = encodeURIComponent(bucket);
  const safePath = path.split("/").map(encodeURIComponent).join("/");
  const endpointPath = endpoint ? `${endpoint}/` : "";
  return `${baseUrl}/storage/v1/object/${endpointPath}${safeBucket}/${safePath}`;
}

function resolveStorageUrl(value, baseUrl) {
  const url = /^https?:\/\//i.test(value)
    ? new URL(value)
    : value.startsWith("/object/")
      ? new URL(`${baseUrl}/storage/v1${value}`)
      : value.startsWith("/storage/v1/")
        ? new URL(value, baseUrl)
        : new URL(value, `${baseUrl}/storage/v1/`);
  if (url.origin !== new URL(baseUrl).origin || url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) {
    throw new StorageUploadError("Supabase Storage returned an invalid signed URL.", 502);
  }
  return url;
}

async function readJson(response, failureMessage) {
  let body;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok || !body) throw new StorageUploadError(failureMessage, 502);
  return body;
}

async function verifyPrivateBucket({ config, contentType, fileSize, fetchImpl }) {
  let bucketInfo;
  try {
    const response = await fetchImpl(`${config.baseUrl}/storage/v1/bucket/${encodeURIComponent(config.bucket)}`, {
      method: "GET",
      headers: storageHeaders(config.serviceRoleKey),
    });
    bucketInfo = await readJson(response, "Configured Supabase Storage bucket was not found.");
  } catch (error) {
    if (error instanceof StorageUploadError) throw error;
    throw new StorageUploadError("Unable to verify the Supabase Storage bucket configuration.", 502);
  }
  if (bucketInfo.public !== false) {
    throw new StorageUploadError("The BytePlus reference-image bucket must be private.", 503);
  }
  const bucketSizeLimit = Number(bucketInfo.file_size_limit);
  if (bucketInfo.file_size_limit === null || !Number.isInteger(bucketSizeLimit) || bucketSizeLimit > MAX_BUCKET_FILE_SIZE_BYTES) {
    throw new StorageUploadError(`Set the private bucket file size limit to ${MAX_BUCKET_FILE_SIZE_BYTES} bytes or less.`, 503);
  }
  if (fileSize > bucketSizeLimit) {
    throw new StorageUploadError("Image exceeds the configured Supabase Storage bucket size limit.");
  }
  if (!Array.isArray(bucketInfo.allowed_mime_types) || !bucketInfo.allowed_mime_types.includes(contentType)) {
    throw new StorageUploadError("Add this image type to the private Supabase Storage bucket MIME allow-list.", 503);
  }
}

function validateImageMetadata({ fileName, contentType, size }) {
  if (typeof fileName !== "string" || !fileName.trim() || fileName.length > 255) {
    throw new StorageUploadError("Choose a valid image file.");
  }
  const imageType = IMAGE_TYPES[contentType];
  if (!imageType) {
    throw new StorageUploadError("Unsupported image type. Use JPEG, PNG, or WebP.");
  }
  if (!Number.isInteger(size) || size < 1 || size > MAX_REFERENCE_IMAGE_BYTES) {
    throw new StorageUploadError("Each reference image must be smaller than 30 MB.");
  }
  return imageType;
}

export async function createSupabaseUploadTicket({
  supabaseUrl,
  serviceRoleKey,
  bucket,
  fileName,
  contentType,
  size,
  fetchImpl = fetch,
  id = randomUUID(),
}) {
  const imageType = validateImageMetadata({ fileName, contentType, size });
  const config = getStorageConfig({ supabaseUrl, serviceRoleKey, bucket });
  await verifyPrivateBucket({ config, contentType, fileSize: size, fetchImpl });
  const path = `seedance/${id}.${imageType.extension}`;
  const url = objectPathUrl(config.baseUrl, config.bucket, path, "upload/sign");

  let uploadInfo;
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: storageHeaders(config.serviceRoleKey, true),
      body: JSON.stringify({ upsert: false }),
    });
    uploadInfo = await readJson(response, "Supabase Storage could not create an upload URL.");
  } catch (error) {
    if (error instanceof StorageUploadError) throw error;
    throw new StorageUploadError("Unable to reach Supabase Storage.", 502);
  }

  const uploadUrlValue = uploadInfo.signedUrl || uploadInfo.signedURL || uploadInfo.url;
  if (typeof uploadUrlValue !== "string") {
    throw new StorageUploadError("Supabase Storage returned an invalid upload URL.", 502);
  }
  const uploadUrl = resolveStorageUrl(uploadUrlValue, config.baseUrl);
  if (!uploadUrl.searchParams.has("token")) {
    throw new StorageUploadError("Supabase Storage returned an invalid upload URL.", 502);
  }
  return { path, uploadUrl: uploadUrl.toString() };
}

export async function createSupabaseReadUrl({
  supabaseUrl,
  serviceRoleKey,
  bucket,
  path,
  fetchImpl = fetch,
}) {
  const config = getStorageConfig({ supabaseUrl, serviceRoleKey, bucket });
  const match = typeof path === "string" && path.match(/^seedance\/([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})\.(jpg|png|webp)$/i);
  if (!match) throw new StorageUploadError("Invalid reference image path.");
  const contentType = Object.keys(IMAGE_TYPES).find((type) => IMAGE_TYPES[type].extension === match[2].toLowerCase());
  if (!contentType) throw new StorageUploadError("Invalid reference image type.");

  const infoUrl = `${config.baseUrl}/storage/v1/object/info/${encodeURIComponent(config.bucket)}/${path.split("/").map(encodeURIComponent).join("/")}`;
  let metadata;
  try {
    const response = await fetchImpl(infoUrl, {
      method: "GET",
      headers: storageHeaders(config.serviceRoleKey),
    });
    metadata = await readJson(response, "Uploaded image could not be verified in Supabase Storage.");
  } catch (error) {
    if (error instanceof StorageUploadError) throw error;
    throw new StorageUploadError("Unable to verify the uploaded image in Supabase Storage.", 502);
  }
  const storedSize = Number(metadata.metadata?.size ?? metadata.size);
  if (!Number.isInteger(storedSize) || storedSize < 1 || storedSize > MAX_REFERENCE_IMAGE_BYTES) {
    throw new StorageUploadError("Uploaded image must be smaller than 30 MB.");
  }
  const storedType = metadata.metadata?.mimetype || metadata.mimetype;
  if (storedType && storedType.toLowerCase().split(";")[0] !== contentType) {
    throw new StorageUploadError("Uploaded image content type does not match its file type.");
  }

  let imageBytes;
  try {
    const response = await fetchImpl(objectPathUrl(config.baseUrl, config.bucket, path), {
      method: "GET",
      headers: { ...storageHeaders(config.serviceRoleKey), Range: "bytes=0-15" },
    });
    if (!response.ok) throw new Error();
    imageBytes = new Uint8Array(await response.arrayBuffer());
  } catch {
    throw new StorageUploadError("Uploaded image could not be validated.", 502);
  }
  if (imageBytes.byteLength > 16 || !IMAGE_TYPES[contentType].signature(imageBytes)) {
    throw new StorageUploadError("Uploaded file is not a valid image of the declared type.");
  }

  let signedInfo;
  try {
    const response = await fetchImpl(objectPathUrl(config.baseUrl, config.bucket, path, "sign"), {
      method: "POST",
      headers: storageHeaders(config.serviceRoleKey, true),
      body: JSON.stringify({ expiresIn: SIGNED_READ_URL_TTL_SECONDS }),
    });
    signedInfo = await readJson(response, "Supabase Storage could not create a temporary image URL.");
  } catch (error) {
    if (error instanceof StorageUploadError) throw error;
    throw new StorageUploadError("Unable to create a temporary image URL.", 502);
  }

  if (typeof signedInfo.signedURL !== "string") {
    throw new StorageUploadError("Supabase Storage returned an invalid signed image URL.", 502);
  }
  return resolveStorageUrl(signedInfo.signedURL, config.baseUrl).toString();
}