import { NextApiRequest, NextApiResponse } from 'next';
import { createHmac } from 'crypto';

const GOOGLE_CLIENT_ID = '437927730977-t2hkbs73o06fqoiurpuok06eeg0umlnj.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI = 'https://disco-agent-portal.vercel.app/api/oauth/google';
const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/drive';
const WEBHOOK_BASE = 'https://dias-mac-studio.tail4f36cb.ts.net/webhooks';
const WEBHOOK_SECRET = 'XmNJhcvbY596Ue9jK4c3LsDQRoiKK3CmnUo238c9g94';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, state, user } = req.query;

  // Callback from Google: exchange code for tokens
  if (code && state) {
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: code as string,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code',
        }).toString(),
      });

      const tokens = await tokenRes.json();

      if (tokens.error) {
        console.error('Google token exchange failed:', tokens);
        res.setHeader('Content-Type', 'text/html');
        res.status(400).send(`<html><body><h3>Google auth failed</h3><p>${tokens.error_description || tokens.error}</p></body></html>`);
        return;
      }

      // Forward tokens to the Mac webhook for storage
      try {
        await fetch(`${WEBHOOK_BASE}/oauth-google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: state,
            tokens,
            service: 'google',
          }),
        });
      } catch (webhookErr) {
        console.error('Webhook forward failed (non-fatal):', webhookErr);
      }

      // Also trigger employee provisioning: create GDrive folders + GBrain context
      try {
        const body = JSON.stringify({
          userId: state,
          slackId: state,
          googleTokens: tokens,
        });
        const signature = createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
        await fetch(`${WEBHOOK_BASE}/onboard`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Hermes-Signature': signature,
          },
          body,
        });
        console.log(`Onboard webhook triggered for user ${state}`);
      } catch (onboardErr) {
        console.error('Onboard webhook call failed (non-fatal):', onboardErr);
      }

      // Close the popup and notify the parent window
      res.setHeader('Content-Type', 'text/html');
      res.send(`<!DOCTYPE html><html><head><title>Google Connected</title></head><body>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'oauth-connected', service: 'google', userId: '${state}' }, '*');
            window.close();
          } else {
            window.location.href = '/?connected=google';
          }
        </script>
        <p style="text-align:center;font-family:sans-serif;margin-top:40px">Google connected! This window will close.</p>
      </body></html>`);
    } catch (e: any) {
      console.error('Google OAuth error:', e);
      res.setHeader('Content-Type', 'text/html');
      res.status(500).send(`<html><body><h3>OAuth failed</h3><p>${e.message}</p></body></html>`);
    }
    return;
  }

  // Start OAuth: redirect to Google
  if (user) {
    const authUrl = `https://accounts.google.com/o/oauth2/auth?` +
      `client_id=${GOOGLE_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(SCOPE)}` +
      `&access_type=offline` +
      `&prompt=consent` +
      `&state=${user}`;

    res.redirect(authUrl);
    return;
  }

  return res.status(400).json({ error: 'user query param required' });
}
