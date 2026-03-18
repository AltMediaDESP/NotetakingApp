import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

const MAX_BODY_BYTES = 500_000; // 500 KB

export async function POST(req: NextRequest) {
  try {
    const contentLength = req.headers.get('content-length');
    const length = parseInt(contentLength ?? '', 10);
    if (!isNaN(length) && length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Request body too large (max 500KB)' }, { status: 413 });
    }

    const body = await req.json();
    const bodySize = Buffer.byteLength(JSON.stringify(body));
    if (bodySize > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Request body too large (max 500KB)' }, { status: 413 });
    }
    const sources = body.sources;

    if (!Array.isArray(sources) || sources.length === 0) {
      return NextResponse.json({ error: 'Valid sources array required' }, { status: 400 });
    }

    // Generate unique task IDs for .tmp/ storage
    const taskId = uuidv4();
    const tmpDir = path.join(process.cwd(), '.tmp');
    const inputPath = path.join(tmpDir, `${taskId}_input.json`);
    const outputPath = path.join(tmpDir, `${taskId}_output.json`);
    const venvPythonPath = path.join(process.cwd(), '.venv', 'bin', 'python');
    const toolPath = path.join(process.cwd(), 'tools', 'generate_note.py');

    // Ensure .tmp/ exists
    await fs.mkdir(tmpDir, { recursive: true });

    // Write input payload
    await fs.writeFile(inputPath, JSON.stringify({ sources }), 'utf8');

    // Execute Deterministic Tool (Layer 3)
    return new Promise((resolve) => {
      const toolProcess = spawn(venvPythonPath, [toolPath, inputPath, outputPath]);

      toolProcess.on('close', async (code) => {
        try {
          // Read Output Payload
          let outputData = { error: 'Unknown tool failure' };
          let statusCode = 500;

          if (code === 0) {
            const outputBuffer = await fs.readFile(outputPath, 'utf8');
            outputData = JSON.parse(outputBuffer);
            statusCode = 200;
          }

          resolve(NextResponse.json(outputData, { status: statusCode }));

        } catch (e: any) {
          resolve(NextResponse.json({ error: `Failed to read tool output: ${e.message}` }, { status: 500 }));
        } finally {
          // Self-cleaning: Remove temporary intermediates
          await fs.rm(inputPath, { force: true }).catch(() => {});
          await fs.rm(outputPath, { force: true }).catch(() => {});
        }
      });
      
      toolProcess.stderr.on('data', (data) => {
          console.error(`Tool Stderr: ${data}`);
      });
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
