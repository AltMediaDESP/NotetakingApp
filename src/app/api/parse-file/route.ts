import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > 5_000_000) {
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (file.name.endsWith('.txt')) {
      return NextResponse.json({ text: buffer.toString('utf8') });
    }

    if (file.name.endsWith('.pdf')) {
      // Use inner module path to avoid pdf-parse v1 test file loading issue
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse/lib/pdf-parse.js');
      const data = await pdfParse(buffer);
      return NextResponse.json({ text: data.text });
    }

    return NextResponse.json({ error: 'Unsupported file type. Use .pdf or .txt' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
