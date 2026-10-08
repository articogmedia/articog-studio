import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getLocaleFromPathname } from './lib/locales';

function addSecurityHeaders(response) {
    // Prevent MIME type sniffing (CWE-693)
    response.headers.set('X-Content-Type-Options', 'nosniff');
    // Prevent clickjacking (CWE-1021)
    response.headers.set('X-Frame-Options', 'DENY');
    // Enable XSS filter in legacy browsers
    response.headers.set('X-XSS-Protection', '1; mode=block');
    // Referrer policy
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Content Security Policy - restricts script sources to prevent XSS (CWE-79).
    // connect-src covers *.muapi.ai (not just api.muapi.ai) because generated
    // media, model thumbnails, and other assets are served from cdn.muapi.ai
    // and other muapi subdomains that the renderer fetches directly.
    response.headers.set(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' data: blob: https:; connect-src 'self' https://muapi.ai https://*.muapi.ai https://*.supabase.co wss://*.supabase.co; font-src 'self' data:;"
    );
    return response;
}

export async function middleware(request) {
    const url = request.nextUrl;
    let response = NextResponse.next({ request });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (supabaseUrl && supabaseKey && !url.pathname.startsWith('/api/')) {
        const supabase = createServerClient(supabaseUrl, supabaseKey, {
            cookies: {
                getAll: () => request.cookies.getAll(),
                setAll: (list) => {
                    list.forEach(({ name, value }) => request.cookies.set(name, value));
                    response = NextResponse.next({ request });
                    list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
                },
            },
        });
        const { error } = await supabase.auth.getUser();
        if (error && error.name !== 'AuthSessionMissingError') {
            console.error('[auth] session refresh failed', error.name || 'unknown', error.status || '');
        }
    }

    // Catch requests to /api/workflow, /api/app, and /api/v1
    const isMuApi = url.pathname.startsWith('/api/workflow') ||
                    url.pathname.startsWith('/api/app') ||
                    url.pathname.startsWith('/api/v1');

    if (isMuApi) {
        // Exclude paths that have their own dedicated route handlers with custom logic
        const isHandledByRoute = url.pathname.startsWith('/api/v1/creative-agent') ||
                                url.pathname.startsWith('/api/v1/account/balance') ||
                                url.pathname.startsWith('/api/v1/predictions/') ||
                                url.pathname.startsWith('/api/v1/upload_url') ||
                                url.pathname.startsWith('/api/v1/upload_file') ||
                                url.pathname.startsWith('/api/v1/get_upload_url') ||
                                url.pathname.startsWith('/api/v1/upload-binary');

        if (process.env.NEXT_PUBLIC_USE_OWN_GATEWAY !== 'true' && url.pathname.startsWith('/api/v1') && !isHandledByRoute) {
            const targetUrl = new URL(url.pathname + url.search, 'https://api.muapi.ai');
            const rewriteResponse = NextResponse.rewrite(targetUrl);
            return addSecurityHeaders(rewriteResponse);
        }
    }

    // Plain response header carrying the locale derived from the URL path
    // (same "set in middleware, read via headers() in the root layout"
    // trick the main muapi client uses — see docs/localization.md).
    response.headers.set('x-locale', getLocaleFromPathname(url.pathname));
    return addSecurityHeaders(response);
}

// Match all paths for security headers. Exclude Next.js internal paths.
export const config = {
    matcher: [
        '/api/:path*',
        '/((?!_next/static|_next/image|favicon.ico|__nextjs_original-stack-frame).*)',
    ],
};
