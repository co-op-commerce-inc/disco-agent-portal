import { NextApiRequest, NextApiResponse } from 'next';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const REDIRECT_URI = 'https://disco-agent-portal.vercel.app/api/oauth/github';
const SCOPE = 'repo,read:org,read:user';
const WEBHOOK_BASE = 'https://dias-mac-studio.tail4f36cb.ts.net/webhooks';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, state, user } = req.query;

  // Callback from GitHub: exchange code for access token
  if (code && state) {
    try {
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code: code as string,
          redirect_uri: REDIRECT_URI,
        }),
      });

      const tokenData = await tokenRes.json();

      if (tokenData.error) {
        console.error('GitHub token exchange failed:', tokenData);
        res.setHeader('Content-Type', 'text/html');
        res.status(400).send(`<html><body><h3>GitHub auth failed</h3><p>${tokenData.error_description || tokenData.error}</p></body></html>`);
        return;
      }

      // Fetch GitHub user info to include with the token
      let userInfo = null;
      if (tokenData.access_token) {
        try {
          const userRes = await fetch('https://api.github.com/user', {
            headers: {
              Authorization: `Bearer ${tokenData.access_token}`,
              'User-Agent': 'disco-agent-portal',
            },
          });
          userInfo = await userRes.json();
        } catch (userErr) {
          console.error('GitHub user fetch failed (non-fatal):', userErr);
        }
      }

      // Forward tokens + user info to the Mac webhook for storage
      try {
        await fetch(`${WEBHOOK_BASE}/oauth-github`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: state,
            tokens: tokenData,
            user: userInfo,
            service: 'github',
          }),
        });
      } catch (webhookErr) {
        console.error('Webhook forward failed (non-fatal):', webhookErr);
      }

      // Close the popup and notify the parent window
      res.setHeader('Content-Type', 'text/html');
      res.send(`<!DOCTYPE html><html><head><title>GitHub Connected</title></head><body>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'oauth-connected', service: 'github', userId: '${state}' }, '*');
            window.close();
          } else {
            window.location.href = '/?connected=github';
          }
        </script>
        <p style="text-align:center;font-family:sans-serif;margin-top:40px">GitHub connected! This window will close.</p>
      </body></html>`);
    } catch (e: any) {
      console.error('GitHub OAuth error:', e);
      res.setHeader('Content-Type', 'text/html');
      res.status(500).send(`<html><body><h3>OAuth failed</h3><p>${e.message}</p></body></html>`);
    }
    return;
  }

  // Start OAuth: redirect to GitHub
  if (user) {
    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
      return res.status(500).json({ error: 'GitHub OAuth not configured — set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET env vars on Vercel' });
    }

    const authUrl = `https://github.com/login/oauth/authorize?` +
      `client_id=${GITHUB_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&scope=${encodeURIComponent(SCOPE)}` +
      `&state=${user}`;

    res.redirect(authUrl);
    return;
  }

  return res.status(400).json({ error: 'user query param required' });
}
