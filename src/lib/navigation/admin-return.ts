export function companyWorkspacePath(companyId: string): string {
  return `/admin/empresas/${encodeURIComponent(companyId)}`;
}

export function companyIdFromRoute(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function safeCompanyReturnPath(value: string | null | undefined, companyId: string): string {
  const expected = companyWorkspacePath(companyId);
  return value === expected ? value : expected;
}

export function pathWithMessage(path: string, message: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}message=${encodeURIComponent(message)}`;
}
