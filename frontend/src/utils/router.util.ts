/**
 * Returns a same-origin relative path, so user supplied redirect targets
 * can't send the user to another site ("//evil.com", "/\evil.com",
 * "/\t/evil.com" are all treated as external URLs by browsers).
 */
export function safeRedirectPath(path: string | undefined) {
  if (!path || typeof path !== "string") return "/";

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (
    normalizedPath.startsWith("//") ||
    normalizedPath.includes("\\") ||
    // eslint-disable-next-line no-control-regex
    /[\u0000-\u001F\u007F]/.test(normalizedPath)
  ) {
    return "/";
  }

  return normalizedPath;
}

export function getQueryString(
  value: string | string[] | undefined,
): string | undefined {
  return typeof value === "string" ? value : undefined;
}
