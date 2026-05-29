import { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm, File as FormidableFile } from 'formidable';
import { createHmac } from 'crypto';
import fs from 'fs';
import path from 'path';

// Disable Next.js body parsing so formidable can handle multipart
export const config = { api: { bodyParser: false } };

const WEBHOOK_BASE = 'https://dias-mac-studio.tail4f36cb.ts.net/webhooks';
const WEBHOOK_SECRET = 'XmNJhcvbY596Ue9jK4c3LsDQRoiKK3CmnUo238c9g94';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse the multipart form data
    const form = new IncomingForm({
      maxFileSize: 50 * 1024 * 1024, // 50MB max
      keepExtensions: true,
    });

    const [fields, files] = await new Promise<[any, any]>((resolve, reject) => {
      form.parse(req, (err: any, fields: any, files: any) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const userId = (Array.isArray(fields.userId) ? fields.userId[0] : fields.userId) || '';
    if (!userId) {
      return res.status(400).json({ error: 'userId field required' });
    }

    // Normalize files array
    const fileList: FormidableFile[] = [];
    const rawFiles = files.files;
    if (rawFiles) {
      if (Array.isArray(rawFiles)) {
        fileList.push(...rawFiles);
      } else {
        fileList.push(rawFiles);
      }
    }

    if (fileList.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Forward each file to the Hermes webhook for GDrive storage
    const results: { name: string; status: string }[] = [];
    for (const file of fileList) {
      try {
        const content = fs.readFileSync(file.filepath, 'base64');
        const body = JSON.stringify({
          userId,
          slackId: userId,
          fileName: file.originalFilename || 'unnamed',
          fileContent: content,
          mimeType: file.mimetype || 'application/octet-stream',
          action: 'upload-project-file',
        });
        const signature = createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');

        const webhookRes = await fetch(`${WEBHOOK_BASE}/onboard`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Hermes-Signature': signature,
          },
          body,
        });

        if (webhookRes.ok) {
          results.push({ name: file.originalFilename || 'unnamed', status: 'uploaded' });
        } else {
          results.push({ name: file.originalFilename || 'unnamed', status: 'webhook_failed' });
        }
      } catch (fileErr: any) {
        console.error(`Failed to process file ${file.originalFilename}:`, fileErr);
        results.push({ name: file.originalFilename || 'unnamed', status: 'error' });
      }
    }

    res.status(200).json({
      message: `Processed ${results.length} file(s)`,
      results,
    });
  } catch (e: any) {
    console.error('Upload handler error:', e);
    res.status(500).json({ error: 'Upload failed: ' + (e.message || 'unknown error') });
  }
}
