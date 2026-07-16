export function isPublicPreview(): boolean {
  if (process.env.PUBLIC_PREVIEW === "true") return true;
  if (process.env.INTERNAL_DASHBOARD_ENABLED === "true") return false;
  return process.env.NODE_ENV === "production";
}
