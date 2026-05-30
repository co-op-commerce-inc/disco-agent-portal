import { NextApiRequest, NextApiResponse } from 'next';
import { createHmac } from 'crypto';

const WEBHOOK_BASE = 'https://dias-mac-studio.tail4f36cb.ts.net/webhooks';
const WEBHOOK_SECRET = 'hCFMQ0C74O1S9rZZgzOhoov4RuLIiM3a35dkHShwOSI';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, displayName } = req.body || {};

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  const body = JSON.stringify({
    action: 'create-drive-workspace',
    userId,
    slackId: userId,
    displayName: displayName || userId,
    folderName: `${displayName || userId} - Stu Workspace`,
    projectFolder: 'Claude Code Projects',
  });
  const signature = createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');

  try {
    const webhookRes = await fetch(`${WEBHOOK_BASE}/onboard`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hermes-Signature': signature,
      },
      body,
    });

    let payload: any = {};
    try {
      payload = await webhookRes.json();
    } catch {
      payload = {};
    }

    if (!webhookRes.ok) {
      return res.status(webhookRes.status).json({
        error: payload.error || 'Workspace creation failed',
      });
    }

    res.status(200).json({
      message: 'Workspace created',
      folderName: `${displayName || userId} - Stu Workspace`,
      projectFolder: 'Claude Code Projects',
      ...payload,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Workspace creation failed' });
  }
}
