export function isPublicPreview(): boolean {
  return process.env.NODE_ENV === "production" || process.env.PUBLIC_PREVIEW === "true";
}
