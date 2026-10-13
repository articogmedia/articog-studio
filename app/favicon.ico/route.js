export function GET(request) {
  return Response.redirect(new URL('/articog-logo.png', request.url), 308);
}