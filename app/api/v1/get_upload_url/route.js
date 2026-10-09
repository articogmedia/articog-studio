import { NextResponse } from 'next/server';
import { getForwardableApiKey, stripInternalSessionCredential } from '@/lib/muapi/auth';

const MUAPI_BASE = 'https://api.muapi.ai';

function getApiKey(request) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        if (token) return getForwardableApiKey(token);
    }
    const headerKey = request.headers.get('x-api-key');
    return getForwardableApiKey(headerKey);
}

function cleanHeaders(request) {
    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('connection');
    headers.delete('cookie');
    headers.delete('authorization');
    return stripInternalSessionCredential(headers);
}

export async function GET(request) {
    const apiKey = getApiKey(request);
    if (!apiKey) {
        return NextResponse.json({ error: 'Unauthorized: Missing API key' }, { status: 401 });
    }

    const { search } = new URL(request.url);
    const targetUrl = `${MUAPI_BASE}/app/get_file_upload_url${search}`;

    const headers = cleanHeaders(request);
    headers.set('x-api-key', apiKey);

    try {
        const response = await fetch(targetUrl, {
            headers,
            method: 'GET',
        });

        const data = await response.json();

        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

