export function isDedicatedApiRoute(pathname) {
  return pathname.startsWith('/api/v1/creative-agent') ||
    pathname.startsWith('/api/v1/account/balance') ||
    pathname.startsWith('/api/v1/predictions/') ||
    pathname.startsWith('/api/v1/upload_url') ||
    pathname.startsWith('/api/v1/upload_file') ||
    pathname.startsWith('/api/v1/get_upload_url') ||
    pathname.startsWith('/api/v1/upload-binary');
}

export function shouldRefreshSupabaseSession(pathname, useOwnGateway) {
  const isExternalMuapiRewrite = pathname.startsWith('/api/v1') &&
    !useOwnGateway &&
    !isDedicatedApiRoute(pathname);

  return !isExternalMuapiRewrite;
}