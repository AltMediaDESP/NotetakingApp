import { NextRequest, NextResponse } from "next/server";
import HTMLtoDOCX from "html-to-docx";

export async function POST(req: NextRequest) {
  const { html, title, filename } = await req.json();

  const buffer = await HTMLtoDOCX(
    `<html><body>${html}</body></html>`,
    undefined,
    { title: title || "Note", margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } }
  );

  const buf = buffer as unknown as Buffer;
  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  return new NextResponse(arrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename || "note"}.docx"`,
    },
  });
}
