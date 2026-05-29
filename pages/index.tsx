import { useState } from 'react';

const GOOGLE_CLIENT_ID = '437927730977-t2hkbs73o06fqoiurpuok06eeg0umlnj.apps.googleusercontent.com';

function getUrlParam(key: string): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get(key) || '';
}

export default function Home() {
  // Auto-detect user from URL params (Slack OAuth callback) or local storage
  const [userId, setUserId] = useState(() => getUrlParam('id') || getUrlParam('userId') || '');
  const [userName, setUserName] = useState(() => getUrlParam('name') || '');
  const [tab, setTab] = useState<'services'|'profile'|'style'|'projects'|'guide'>('guide');
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState({ role: '', team: '', timezone: 'America/Los_Angeles', focus: '', goals: '', collaborators: '' });
  const [style, setStyle] = useState({ verbosity: 'concise', proactivity: 'medium', humor: 'medium', format: 'bullets', emoji: true });
  const [services, setServices] = useState<Record<string, boolean>>({});
  const [showGranolaKey, setShowGranolaKey] = useState(false);
  const [granolaKey, setGranolaKey] = useState('');
  const [message, setMessage] = useState('');

  const tabs = [
    { key: 'services', label: '🔗 Services' },
    { key: 'profile', label: '👤 Profile' },
    { key: 'style', label: '🎨 Style' },
    { key: 'projects', label: '📁 Projects' },
    { key: 'guide', label: '🚀 Guide' },
  ];

  const connectGoogle = () => {
    if (!userId) { setMessage('Enter your Slack User ID first'); return; }
    const scope = 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/drive.readonly';
    const redirect = 'https://dias-mac-studio.tail4f36cb.ts.net/webhooks/oauth-google';
    window.open(`https://accounts.google.com/o/oauth2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirect)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent&state=${userId}`);
    setMessage('Approve the Google prompt in the window that opened');
  };

  const saveGranolaKey = async () => {
    if (!userId || !granolaKey) return;
    await fetch(`https://dias-mac-studio.tail4f36cb.ts.net/webhooks/oauth-granola`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, apiKey: granolaKey, service: 'granola' }),
    });
    setServices(s => ({ ...s, granola: true })); setShowGranolaKey(false);
    setMessage('Granola connected!');
  };

  const saveProfile = async () => {
    if (!userId) return;
    await fetch(`https://dias-mac-studio.tail4f36cb.ts.net/webhooks/onboard`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, displayName: userId, ...profile, ...style }),
    });
    setSaved(true); setMessage('Profile saved! Rhythm will use this to personalize your experience.');
  };

  if (!userId) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', fontFamily: 'system-ui' }}>
        <div style={{ textAlign: 'center', color: 'white', maxWidth: 420 }}>
          <h1 style={{ fontSize: 64, margin: 0, letterSpacing: -2 }}>Rhythm</h1>
          <p style={{ fontSize: 20, opacity: 0.9, marginTop: 8 }}>Your Disco AI agent</p>
          <p style={{ fontSize: 14, opacity: 0.7, marginTop: 16 }}>
            Connect your accounts, set your preferences, and make Rhythm yours.
          </p>
          <a href={`https://slack.com/oauth/v2/authorize?client_id=879184060177.11209135000535&scope=openid,profile,email&redirect_uri=${encodeURIComponent('https://disco-agent-portal.vercel.app/api/oauth/slack')}`}
            style={{ display: 'inline-block', marginTop: 32, padding: '14px 40px', fontSize: 18,
              background: 'white', color: '#1a1a2e', border: 'none', borderRadius: 8,
              cursor: 'pointer', fontWeight: 600, textDecoration: 'none' }}>
            <span style={{ marginRight: 8 }}>🔗</span> Sign in with Slack
          </a>
          <p style={{ fontSize: 13, opacity: 0.5, marginTop: 32 }}>
            Or enter your Slack User ID manually
          </p>
          <input placeholder="URTU2JQCT" 
            onChange={e => { if (e.target.value.length > 8) setUserId(e.target.value); }}
            style={{ marginTop: 8, padding: '10px 16px', borderRadius: 8, border: 'none', fontSize: 16, width: 200, textAlign: 'center' }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 40, fontFamily: 'system-ui', background: '#fafafa', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 36, fontWeight: 800, margin: 0 }}>Rhythm</h1>
      <p style={{ color: '#888', marginTop: 4 }}>Your Disco AI agent — personalized to how you work.</p>

      <div style={{ margin: '20px 0', background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 16 }}>
        <label style={{ fontWeight: 600, fontSize: 14 }}>Slack User ID</label>
        <p style={{ color: '#999', fontSize: 12, margin: '2px 0 8px' }}>Slack → Profile → ⋯ → Copy member ID</p>
        <input value={userId} onChange={e => setUserId(e.target.value)} placeholder="URTU2JQCT"
          style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #d1d5db', fontSize: 16 }} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
              background: tab === t.key ? '#1a1a2e' : '#e5e7eb', color: tab === t.key ? 'white' : '#666' }}>
            {t.label}
          </button>
        ))}
      </div>

      {message && <div style={{ background: '#fef3c7', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 14 }}>{message}</div>}

      {tab === 'services' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24 }}>
          <h3 style={{ margin: '0 0 16px' }}>Connected Services</h3>
          {[
            { icon: '📧', name: 'Google', desc: 'Gmail, Calendar, Drive', color: '#4285f4', key: 'google' },
            { icon: '🐙', name: 'GitHub', desc: 'Repos, PRs, code', color: '#24292e', key: 'github' },
          ].map(s => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 22 }}>{s.icon}</span>
                <div><strong>{s.name}</strong><div style={{ color: '#888', fontSize: 13 }}>{s.desc}</div></div>
              </div>
              {services[s.key] ? <span style={{ color: '#10b981', fontSize: 13 }}>✅ Connected</span> : (
                <button onClick={s.key === 'google' ? connectGoogle : () => window.open(`/api/oauth/github?user=${userId}`)}
                  style={{ background: s.color, color: 'white', border: 'none', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Connect</button>
              )}
            </div>
          ))}
          <div style={{ padding: '14px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 22 }}>📝</span>
                <div><strong>Granola</strong><div style={{ color: '#888', fontSize: 13 }}>Meeting notes</div></div>
              </div>
              {services.granola ? <span style={{ color: '#10b981', fontSize: 13 }}>✅ Connected</span> : showGranolaKey ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={granolaKey} onChange={e => setGranolaKey(e.target.value)} placeholder="Paste API key" style={{ padding: 6, borderRadius: 4, border: '1px solid #d1d5db', width: 160, fontSize: 13 }} />
                  <button onClick={saveGranolaKey} style={{ background: '#10b981', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Save</button>
                </div>
              ) : (
                <button onClick={() => setShowGranolaKey(true)} style={{ background: '#10b981', color: 'white', border: 'none', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Connect</button>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'profile' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24 }}>
          <h3 style={{ margin: '0 0 16px' }}>Your Profile</h3>
          {[
            { key: 'role', label: 'Role', placeholder: 'Product Engineer', hint: 'What do you do at Disco?' },
            { key: 'team', label: 'Team', placeholder: 'Marketplace', hint: 'Which team are you on?' },
            { key: 'timezone', label: 'Timezone', placeholder: 'America/Los_Angeles' },
            { key: 'focus', label: 'Current Focus', placeholder: 'Auction model optimization, Q2 planning', hint: 'What are you working on right now? Top 1-2 things.' },
            { key: 'goals', label: 'Goals / Bets', placeholder: 'Ship auction V2 by EOM', hint: 'What outcomes are you driving toward?' },
            { key: 'collaborators', label: 'Key Collaborators', placeholder: 'Aaron, Gaurav, Lydia', hint: 'Who do you work with most? (@names)' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 16 }}>
              <label style={{ fontWeight: 600, fontSize: 13 }}>{f.label}</label>
              {f.hint && <div style={{ color: '#aaa', fontSize: 12 }}>{f.hint}</div>}
              <input value={(profile as any)[f.key]} onChange={e => setProfile({ ...profile, [f.key]: e.target.value })} placeholder={f.placeholder}
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14, marginTop: 4 }} />
            </div>
          ))}
        </div>
      )}

      {tab === 'style' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24 }}>
          <h3 style={{ margin: '0 0 16px' }}>How Rhythm Works With You</h3>
          {[
            { key: 'verbosity', label: 'Response Style', options: ['concise', 'detailed'], desc: 'Short and punchy, or thorough with context?' },
            { key: 'proactivity', label: 'Proactivity', options: ['low', 'medium', 'high'], desc: 'Wait to be asked, or suggest things unprompted?' },
            { key: 'format', label: 'Format', options: ['bullets', 'paragraphs', 'mixed'], desc: 'How should I structure responses?' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 20 }}>
              <label style={{ fontWeight: 600, fontSize: 13 }}>{f.label}</label>
              <div style={{ color: '#aaa', fontSize: 12, marginBottom: 6 }}>{f.desc}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {f.options.map(o => (
                  <button key={o} onClick={() => setStyle({ ...style, [f.key]: o })}
                    style={{ padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13,
                      background: (style as any)[f.key] === o ? '#1a1a2e' : '#f0f0f0', color: (style as any)[f.key] === o ? 'white' : '#666' }}>
                    {o}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={style.emoji} onChange={e => setStyle({ ...style, emoji: e.target.checked })} />
            <span style={{ fontSize: 13 }}>Use emoji in responses</span>
          </label>
        </div>
      )}

      {tab === 'projects' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24 }}>
          <h3 style={{ margin: '0 0 8px' }}>Import Your Claude Projects</h3>
          <p style={{ color: '#888', fontSize: 13, margin: '0 0 20px' }}>Centralize your work so Rhythm knows everything you've built.</p>

          <div style={{ background: '#f0f4ff', borderRadius: 10, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>📂 Your GDrive Folder</div>
            <div style={{ fontSize: 13, color: '#666' }}>
              All your projects live in <strong>Disco Agent Workspace → people → {userId || 'you'} → claude-projects</strong>
            </div>
            <a href="https://drive.google.com/drive/folders/0ADzUC74f0zEaUk9PVA" target="_blank"
              style={{ display: 'inline-block', marginTop: 12, background: '#4285f4', color: 'white', padding: '8px 16px', borderRadius: 6, textDecoration: 'none', fontSize: 13 }}>
              Open in Google Drive
            </a>
          </div>

          <div style={{ background: '#f9fafb', borderRadius: 10, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>📤 Upload Files</div>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
              Upload Claude project files (.md, .json, .claude/) or any working documents.<br/>
              Rhythm will index them into GBrain so you can search and reference them.
            </div>
            <input type="file" multiple onChange={async (e) => {
              const files = e.target.files;
              if (!files || !userId) return;
              setMessage(`Uploading ${files.length} files...`);
              const formData = new FormData();
              for (let i = 0; i < Math.min(files.length, 20); i++) formData.append('files', files[i]);
              formData.append('userId', userId);
              try {
                await fetch('/api/upload', { method: 'POST', body: formData });
                setMessage(`Uploaded ${Math.min(files.length, 20)} files! Rhythm will index them shortly.`);
              } catch { setMessage('Upload failed — try dragging files to your GDrive folder instead.'); }
            }} style={{ fontSize: 13 }} />
          </div>

          <div style={{ fontSize: 13, color: '#888', lineHeight: 1.6 }}>
            <strong>💡 Tip:</strong> For Claude Code projects, go to <code>~/.claude/projects/</code> on your Mac, 
            drag the project folders into your GDrive folder above. Rhythm auto-indexes new files within 30 minutes.
          </div>
        </div>
      )}

      {tab === 'guide' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24 }}>
          <h3 style={{ margin: '0 0 4px' }}>Welcome to Rhythm</h3>
          <p style={{ color: '#888', fontSize: 13, margin: '0 0 24px' }}>Your personal AI agent with access to all of Disco's data and tools.</p>

          {[
            { emoji: '💬', title: 'How to talk to Rhythm', lines: [
              'DM <strong>@rhythm</strong> in Slack anytime',
              'In channels, just @mention rhythm',
              'Each DM thread is a separate workspace — start a new thread for each project',
              'Rhythm remembers context within each thread',
            ]},
            { emoji: '📊', title: 'Data & Analytics', lines: [
              '<code>"how many users signed up last week?"</code>',
              '<code>"show me Q2 revenue by channel"</code>',
              '<code>"what is our conversion rate this month?"</code>',
              'Rhythm queries Snowflake directly — no SQL needed',
              'Uses Disco\'s semantic models for accurate answers',
            ]},
            { emoji: '🎙', title: 'Customer Intelligence', lines: [
              '<code>"summarize the last Gong call with Lunya"</code>',
              '<code>"what did we discuss with True Classic?"</code>',
              '<code>"find recent calls about marketplace pricing"</code>',
              'Pulls transcripts, highlights, and action items',
            ]},
            { emoji: '💰', title: 'Pipeline & Deals', lines: [
              '<code>"what deals moved this week?"</code>',
              '<code>"show me HubSpot pipeline by stage"</code>',
              '<code>"what is the status of the parcelLab deal?"</code>',
              'Live HubSpot data — stages, amounts, owners',
            ]},
            { emoji: '🔧', title: 'Engineering', lines: [
              '<code>"where does auction logic live in the codebase?"</code>',
              '<code>"review the last 5 PRs in backend"</code>',
              '<code>"what changed in the iOS SDK this sprint?"</code>',
              'Knows every repo, can review code, find bugs',
            ]},
            { emoji: '📝', title: 'Your Personal Context', lines: [
              '<code>"what is on my calendar tomorrow?"</code>',
              '<code>"summarize my Granola notes from this week"</code>',
              '<code>"find my notes about the Q2 planning session"</code>',
              'Connect Gmail, Calendar, Granola on the Services tab',
            ]},
            { emoji: '⏰', title: 'Personal Cron Jobs', lines: [
              '<code>"send me a daily briefing every morning at 8am"</code>',
              '<code>"check for new Gong calls every hour and DM me summaries"</code>',
              '<code>"remind me about open PRs every Monday"</code>',
              'Cron jobs run on your schedule — set and forget',
            ]},
            { emoji: '🎨', title: 'Make Rhythm Yours', lines: [
              'Set your working style on the Style tab (concise vs detailed)',
              'Tell Rhythm your goals and focus areas on the Profile tab',
              'Rhythm adapts to how you work — the more you use it, the better it gets',
              'Each thread is a project workspace — stay organized',
            ]},
          ].map((section, i) => (
            <div key={i} style={{ marginBottom: 24, padding: '16px 0', borderBottom: i < 7 ? '1px solid #f0f0f0' : 'none' }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{section.emoji} {section.title}</div>
              {section.lines.map((line, j) => (
                <div key={j} style={{ fontSize: 13, color: '#555', lineHeight: 2, paddingLeft: 8 }}
                  dangerouslySetInnerHTML={{ __html: '• ' + line }} />
              ))}
            </div>
          ))}
        </div>
      )}

      <button onClick={saveProfile}
        style={{ width: '100%', marginTop: 20, padding: 14, borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 600,
          background: saved ? '#10b981' : '#1a1a2e', color: 'white' }}>
        {saved ? '✅ Profile Saved' : 'Save Profile'}
      </button>
    </div>
  );
}
