import { promises as fs } from 'fs';
import path from 'path';
import { mimeFor } from '@/lib/gateway/storage';

export const runtime = 'nodejs';

export async function GET(request, { params }) {
  const { name } = await params;
  const safe = path.basename(name);

  try {
    const data = await fs.readFile(path.join(process.cwd(), '.data', 'files', safe));
    return new Response(data, {
      headers: {
        'Content-Type': mimeFor(safe),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
