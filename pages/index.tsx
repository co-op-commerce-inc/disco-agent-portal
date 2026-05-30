import { useCallback, useEffect, useMemo, useState } from 'react';

function getUrlParam(key: string): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get(key) || '';
}

const WEBHOOK_BASE = 'https://dias-mac-studio.tail4f36cb.ts.net/webhooks';

const STEPS = [
  {
    key: 'welcome',
    label: 'Overview',
    eyebrow: 'Start here',
    title: 'Set up your Disco agent',
    summary: 'Create the profile your agent will use in Slack, meetings, code reviews, and daily work.',
    why: 'A useful agent needs identity, context, and preferences before it can help without constantly asking follow-up questions.',
    outcome: 'You will know what is being connected, why it matters, and what the agent can do next.',
  },
  {
    key: 'slack',
    label: 'Slack identity',
    eyebrow: 'Required',
    title: 'Anchor the agent to your Slack identity',
    summary: 'Slack is where you will talk to the agent. This step tells it which person these settings belong to.',
    why: 'The Slack ID connects every permission, profile answer, and saved preference to the right teammate.',
    outcome: 'Your agent can recognize you in DMs, mentions, briefings, and setup callbacks.',
  },
  {
    key: 'google',
    label: 'Google',
    eyebrow: 'Recommended',
    title: 'Give the agent schedule and inbox context',
    summary: 'Connect Google so the agent can help with calendar questions, meeting prep, email summaries, and Drive context.',
    why: 'Calendar and email are usually where commitments, blockers, and follow-ups first appear.',
    outcome: 'The agent can reason over the Google access you approve.',
  },
  {
    key: 'github',
    label: 'GitHub',
    eyebrow: 'Recommended',
    title: 'Let the agent understand code work',
    summary: 'Connect GitHub so the agent can explain pull requests, search repositories, and summarize engineering activity.',
    why: 'Code context keeps the agent grounded in the actual work instead of generic project guesses.',
    outcome: 'The agent can reference connected repos, PRs, issues, and code changes.',
  },
  {
    key: 'granola',
    label: 'Granola',
    eyebrow: 'Optional',
    title: 'Add meeting memory',
    summary: 'Connect Granola if you want the agent to use notes, transcripts, decisions, and follow-ups from meetings.',
    why: 'Meeting memory helps the agent recover decisions and keep momentum after a conversation ends.',
    outcome: 'Meeting notes can become searchable context for future asks.',
  },
  {
    key: 'profile',
    label: 'Work profile',
    eyebrow: 'Personalization',
    title: 'Describe what matters in your work',
    summary: 'Share your role, team, focus, and goals so the agent can prioritize information like a teammate would.',
    why: 'The same signal can be urgent for one role and noise for another. Profile context teaches the agent the difference.',
    outcome: 'Answers can be tailored around your responsibilities, timezone, and current priorities.',
  },
  {
    key: 'style',
    label: 'Agent behavior',
    eyebrow: 'Preferences',
    title: 'Choose how the agent should respond',
    summary: 'Set response depth, proactivity, structure, and tone so the agent starts with your preferred defaults.',
    why: 'The interaction should feel right without you correcting length, format, or initiative every day.',
    outcome: 'Your saved preferences shape day-to-day Slack responses.',
  },
  {
    key: 'done',
    label: 'Ready',
    eyebrow: 'Complete',
    title: 'Your agent profile is ready',
    summary: 'Review what is connected, what was skipped, and how to start using the agent in Slack.',
    why: 'A clean handoff makes the setup feel finished and gives you a place to return when preferences change.',
    outcome: 'DM the agent in Slack and come back here anytime to adjust setup.',
  },
] as const;

type StepKey = (typeof STEPS)[number]['key'];
type ServiceName = 'google' | 'github' | 'granola';
type ProfileKey = 'role' | 'team' | 'timezone' | 'focus' | 'goals';
type StyleKey = 'verbosity' | 'proactivity' | 'format';

const SERVICES: Record<
  ServiceName,
  {
    label: string;
    short: string;
    benefits: string[];
    permission: string;
  }
> = {
  google: {
    label: 'Google Workspace',
    short: 'Calendar, Gmail, and Drive context',
    benefits: [
      'Find open time and understand calendar conflicts',
      'Summarize email threads and identify follow-ups',
      'Use Drive files when project context matters',
    ],
    permission: 'You approve the exact Google scopes in the consent window.',
  },
  github: {
    label: 'GitHub',
    short: 'Repositories, PRs, and issue context',
    benefits: [
      'Explain and summarize pull requests',
      'Search code with repository context',
      'Track issues and engineering changes',
    ],
    permission: 'Grant only the GitHub workspace access you want the agent to use.',
  },
  granola: {
    label: 'Granola',
    short: 'Meeting notes and transcripts',
    benefits: [
      'Recover decisions from past conversations',
      'Summarize notes before or after meetings',
      'Track action items without manual copy-paste',
    ],
    permission: 'Paste an API key only if you want meeting memory connected now.',
  },
};

const PROFILE_FIELDS: Array<{
  key: ProfileKey;
  label: string;
  placeholder: string;
  help: string;
}> = [
  {
    key: 'role',
    label: 'Role',
    placeholder: 'Product Engineer',
    help: 'What should the agent assume you are responsible for?',
  },
  {
    key: 'team',
    label: 'Team',
    placeholder: 'Marketplace',
    help: 'Which team or function should context be organized around?',
  },
  {
    key: 'timezone',
    label: 'Timezone',
    placeholder: 'America/Los_Angeles',
    help: 'Used for scheduling, reminders, and briefings.',
  },
  {
    key: 'focus',
    label: 'Current focus',
    placeholder: 'Q2 planning, agent onboarding, auction model',
    help: 'The active projects the agent should keep in mind.',
  },
  {
    key: 'goals',
    label: 'Goals',
    placeholder: 'Ship onboarding V2 and reduce setup friction',
    help: 'Outcomes the agent should help protect.',
  },
];

const STYLE_FIELDS: Array<{
  key: StyleKey;
  label: string;
  help: string;
  options: Array<{ value: string; label: string }>;
}> = [
  {
    key: 'verbosity',
    label: 'Response depth',
    help: 'How much context should the agent include by default?',
    options: [
      { value: 'concise', label: 'Concise' },
      { value: 'detailed', label: 'Detailed' },
    ],
  },
  {
    key: 'proactivity',
    label: 'Initiative',
    help: 'How often should the agent suggest next steps?',
    options: [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Balanced' },
      { value: 'high', label: 'High' },
    ],
  },
  {
    key: 'format',
    label: 'Structure',
    help: 'How should longer answers be organized?',
    options: [
      { value: 'bullets', label: 'Bullets' },
      { value: 'paragraphs', label: 'Paragraphs' },
      { value: 'mixed', label: 'Mixed' },
    ],
  },
];

export default function Home() {
  const [userId, setUserId] = useState(() => getUrlParam('id') || getUrlParam('userId') || '');
  const [userName] = useState(() => getUrlParam('name') || '');
  const [step, setStep] = useState<StepKey>('welcome');
  const [services, setServices] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [granolaKey, setGranolaKey] = useState('');
  const [granolaSaved, setGranolaSaved] = useState(false);
  const [profile, setProfile] = useState<Record<ProfileKey, string>>({
    role: '',
    team: '',
    timezone: 'America/Los_Angeles',
    focus: '',
    goals: '',
  });
  const [style, setStyle] = useState({
    verbosity: 'concise',
    proactivity: 'medium',
    humor: 'medium',
    format: 'bullets',
    emoji: true,
  });

  const currentIndex = STEPS.findIndex((item) => item.key === step);
  const currentStep = STEPS[currentIndex];
  const progress = useMemo(() => {
    if (step === 'done') return 100;
    return Math.round((currentIndex / (STEPS.length - 1)) * 100);
  }, [currentIndex, step]);

  const goTo = useCallback((next: StepKey) => {
    setStep(next);
    setMessage('');
  }, []);

  const nextStep = useCallback(() => {
    const next = STEPS[currentIndex + 1];
    if (next) goTo(next.key);
  }, [currentIndex, goTo]);

  const prevStep = useCallback(() => {
    const prev = STEPS[currentIndex - 1];
    if (prev) goTo(prev.key);
  }, [currentIndex, goTo]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data && event.data.type === 'oauth-connected') {
        setServices((existing) => ({ ...existing, [event.data.service]: true }));
        setMessage(`${event.data.service} connected.`);
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const serviceConnected = (service: ServiceName) => {
    if (service === 'granola') return granolaSaved || services.granola;
    return !!services[service];
  };

  const canOpenStep = (index: number) => {
    if (index <= currentIndex) return true;
    if (STEPS[index].key === 'done') return step === 'done';
    if (!userId && STEPS[index].key !== 'slack') return false;
    return true;
  };

  const connectOAuth = (service: ServiceName) => {
    if (!userId) {
      setMessage('Add your Slack identity first so this connection can be saved to the right profile.');
      goTo('slack');
      return;
    }

    const popup = window.open(
      `/api/oauth/${service}?user=${userId}`,
      `${service}-oauth`,
      'width=600,height=700'
    );

    if (!popup) {
      setMessage('Please allow popups for this site, then try again.');
      return;
    }

    setMessage(`${SERVICES[service].label} approval opened.`);
  };

  const saveGranolaKey = async () => {
    if (!granolaKey.trim()) return;
    if (!userId) {
      setMessage('Add your Slack identity first so the Granola key is saved to the right profile.');
      goTo('slack');
      return;
    }

    setLoading(true);
    try {
      await fetch(`${WEBHOOK_BASE}/oauth-granola`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          apiKey: granolaKey.trim(),
          service: 'granola',
        }),
      });
      setGranolaSaved(true);
      setServices((existing) => ({ ...existing, granola: true }));
      setMessage('Granola key saved.');
    } catch {
      setMessage('Granola key could not be saved. You can skip this and connect later.');
    }
    setLoading(false);
  };

  const submitOnboarding = async () => {
    setLoading(true);
    try {
      await fetch(`${WEBHOOK_BASE}/onboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          slackId: userId,
          displayName: userName || userId,
          ...profile,
          ...style,
          services,
        }),
      });
      setMessage('Profile saved.');
    } catch {
      setMessage('Profile save did not return successfully. Your local choices are still shown here.');
    }
    setLoading(false);
    goTo('done');
  };

  const renderWelcome = () => (
    <div className="stack">
      <div className="overview-grid">
        {[
          {
            label: 'Identity',
            title: 'Start with Slack',
            body: 'The agent needs a Slack member ID before it can save service connections and preferences.',
          },
          {
            label: 'Context',
            title: 'Connect what matters',
            body: 'Google, GitHub, and Granola are optional but make the agent more aware of your work.',
          },
          {
            label: 'Behavior',
            title: 'Tune the defaults',
            body: 'Set role context and response style once, then adjust later as the agent learns your workflow.',
          },
        ].map((item) => (
          <article key={item.label} className="intro-tile">
            <span>{item.label}</span>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </article>
        ))}
      </div>

      <div className="timeline">
        {STEPS.slice(1, -1).map((item, index) => (
          <div key={item.key} className="timeline-item">
            <span>{index + 1}</span>
            <div>
              <strong>{item.label}</strong>
              <small>{item.eyebrow}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSlack = () => (
    <div className="stack">
      <section className="setup-section">
        <div className="section-heading">
          <span>Required first</span>
          <h2>Slack is the account anchor</h2>
          <p>Use Slack sign-in when possible. If you already have your member ID, paste it directly.</p>
        </div>

        {!userId ? (
          <div className="identity-grid">
            <a
              href={`https://slack.com/openid/connect/authorize?response_type=code&client_id=879184060177.11209135000535&scope=openid,profile,email&redirect_uri=${encodeURIComponent(
                'https://disco-agent-portal.vercel.app/api/oauth/slack'
              )}`}
              className="choice-card"
            >
              <span className="choice-icon">S</span>
              <span>
                <strong>Sign in with Slack</strong>
                <small>Recommended path</small>
              </span>
              <em>Open</em>
            </a>

            <div className="manual-card">
              <label htmlFor="slack-id">Slack member ID</label>
              <input
                id="slack-id"
                value={userId}
                onChange={(event) => setUserId(event.target.value.trim())}
                placeholder="Example: URTU2JQCT"
                className="text-input"
              />
              <p>Find it in Slack profile, more menu, Copy member ID.</p>
            </div>
          </div>
        ) : (
          <div className="connected-banner">
            <span />
            <div>
              <strong>Slack identity saved</strong>
              <p>{userId}</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );

  const renderService = (service: ServiceName) => {
    const config = SERVICES[service];
    const connected = serviceConnected(service);

    return (
      <div className="stack">
        <section className="setup-section">
          <div className="section-heading">
            <span>{connected ? 'Connected' : 'Connection'}</span>
            <h2>{config.label}</h2>
            <p>{config.short}</p>
          </div>

          <div className="integration-row">
            <div className="integration-mark">{config.label.slice(0, 1)}</div>
            <div>
              <strong>{config.label}</strong>
              <p>{connected ? 'This source is ready for the agent.' : config.permission}</p>
            </div>
            {connected ? (
              <span className="status-pill connected">Connected</span>
            ) : service === 'granola' ? (
              <span className="status-pill">API key</span>
            ) : (
              <button className="button secondary compact" onClick={() => connectOAuth(service)}>
                Connect
              </button>
            )}
          </div>

          {service === 'granola' && !connected && (
            <div className="key-row">
              <input
                type="password"
                value={granolaKey}
                onChange={(event) => setGranolaKey(event.target.value)}
                placeholder="Paste Granola API key"
                className="text-input"
              />
              <button
                className="button secondary"
                onClick={saveGranolaKey}
                disabled={!granolaKey.trim() || loading}
              >
                {loading ? 'Saving...' : 'Save key'}
              </button>
            </div>
          )}
        </section>

        <section className="setup-section">
          <div className="section-heading compact-heading">
            <span>What this unlocks</span>
          </div>
          <ul className="benefit-list">
            {config.benefits.map((benefit) => (
              <li key={benefit}>{benefit}</li>
            ))}
          </ul>
        </section>
      </div>
    );
  };

  const renderProfile = () => (
    <div className="stack">
      <section className="setup-section">
        <div className="section-heading">
          <span>Profile</span>
          <h2>Teach the agent your working context</h2>
          <p>Short, plain answers are enough. The agent uses these as defaults, not as permanent rules.</p>
        </div>
        <div className="field-grid">
          {PROFILE_FIELDS.map((field) => (
            <label key={field.key} className="field">
              <span>{field.label}</span>
              <input
                value={profile[field.key]}
                onChange={(event) => setProfile({ ...profile, [field.key]: event.target.value })}
                placeholder={field.placeholder}
                className="text-input"
              />
              <small>{field.help}</small>
            </label>
          ))}
        </div>
      </section>
    </div>
  );

  const renderStyle = () => (
    <div className="stack">
      <section className="setup-section">
        <div className="section-heading">
          <span>Behavior</span>
          <h2>Set the default response style</h2>
          <p>These controls are intentionally simple: depth, initiative, structure, and a light tone preference.</p>
        </div>

        <div className="preference-list">
          {STYLE_FIELDS.map((field) => (
            <div key={field.key} className="preference-row">
              <div>
                <strong>{field.label}</strong>
                <p>{field.help}</p>
              </div>
              <div className="segmented">
                {field.options.map((option) => (
                  <button
                    key={option.value}
                    className={style[field.key] === option.value ? 'active' : ''}
                    onClick={() => setStyle({ ...style, [field.key]: option.value })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <label className="switch-row">
            <input
              type="checkbox"
              checked={style.emoji}
              onChange={(event) => setStyle({ ...style, emoji: event.target.checked })}
            />
            <span className="switch-track">
              <span />
            </span>
            <div>
              <strong>Allow emoji when it fits</strong>
              <p>Keep it subtle; useful for warmth, not decoration.</p>
            </div>
          </label>
        </div>
      </section>
    </div>
  );

  const renderDone = () => (
    <div className="stack">
      <section className="setup-section">
        <div className="section-heading">
          <span>Summary</span>
          <h2>Ready to use in Slack</h2>
          <p>Here is what the agent knows before the first conversation.</p>
        </div>

        <div className="summary-list">
          <SummaryRow label="Slack" value={userId || 'Not set'} />
          <SummaryRow label="Google" value={serviceConnected('google') ? 'Connected' : 'Skipped'} />
          <SummaryRow label="GitHub" value={serviceConnected('github') ? 'Connected' : 'Skipped'} />
          <SummaryRow label="Granola" value={serviceConnected('granola') ? 'Connected' : 'Skipped'} />
          <SummaryRow label="Role" value={profile.role || 'Not set'} />
          <SummaryRow label="Style" value={`${style.verbosity} / ${style.proactivity} / ${style.format}`} />
        </div>
      </section>

      <section className="setup-section action-panel">
        <div>
          <span>Next</span>
          <h2>DM @gruv in Slack</h2>
          <p>Ask for a briefing, a PR summary, meeting follow-ups, or help finding what needs attention.</p>
        </div>
        <a href={`/?id=${userId}`} className="return-link">
          Bookmark setup link
        </a>
      </section>
    </div>
  );

  const renderStep = () => {
    switch (step) {
      case 'welcome':
        return renderWelcome();
      case 'slack':
        return renderSlack();
      case 'google':
        return renderService('google');
      case 'github':
        return renderService('github');
      case 'granola':
        return renderService('granola');
      case 'profile':
        return renderProfile();
      case 'style':
        return renderStyle();
      case 'done':
        return renderDone();
      default:
        return null;
    }
  };

  const primaryAction = () => {
    if (step === 'style') return submitOnboarding;
    if (step === 'done') return () => goTo('welcome');
    return nextStep;
  };

  const primaryLabel = () => {
    if (step === 'welcome') return 'Begin setup';
    if (step === 'style') return loading ? 'Saving...' : 'Finish setup';
    if (step === 'done') return 'Review setup';
    return 'Continue';
  };

  const primaryDisabled = step === 'slack' && !userId;
  const showSkip =
    (step === 'google' && !serviceConnected('google')) ||
    (step === 'github' && !serviceConnected('github')) ||
    (step === 'granola' && !serviceConnected('granola'));

  return (
    <>
      <div className="app">
        <aside className="rail">
          <div className="brand">
            <div className="brand-mark">D</div>
            <div>
              <strong>Disco Agent</strong>
              <span>Onboarding</span>
            </div>
          </div>

          <div className="progress-block">
            <div>
              <span>Setup</span>
              <strong>{progress}%</strong>
            </div>
            <div className="progress-track">
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>

          <nav className="step-nav" aria-label="Setup steps">
            {STEPS.map((item, index) => {
              const active = item.key === step;
              const complete = index < currentIndex || step === 'done';
              const locked = !canOpenStep(index);

              return (
                <button
                  key={item.key}
                  disabled={locked}
                  onClick={() => !locked && goTo(item.key)}
                  className={`${active ? 'active' : ''} ${complete ? 'complete' : ''}`}
                >
                  <span className="step-dot">{complete ? 'OK' : index + 1}</span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.eyebrow}</small>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="rail-footer">
            <span>Need help?</span>
            <a href="mailto:support@disco.co">Contact support</a>
          </div>
        </aside>

        <main className="main">
          <header className="topbar">
            <div>
              <span>{currentStep.eyebrow}</span>
              <strong>{currentStep.label}</strong>
            </div>
            {userId && <div className="user-chip">{userId}</div>}
          </header>

          {message && <div className="toast">{message}</div>}

          <div className="content-grid">
            <section className="primary-pane">
              <div className="hero-copy">
                <span>{currentStep.eyebrow}</span>
                <h1>{currentStep.title}</h1>
                <p>{currentStep.summary}</p>
              </div>
              {renderStep()}
            </section>

            <aside className="brief">
              <div>
                <span>Why this matters</span>
                <p>{currentStep.why}</p>
              </div>
              <div>
                <span>Outcome</span>
                <p>{currentStep.outcome}</p>
              </div>
              <div>
                <span>Connections</span>
                <ConnectionLine label="Google" connected={serviceConnected('google')} />
                <ConnectionLine label="GitHub" connected={serviceConnected('github')} />
                <ConnectionLine label="Granola" connected={serviceConnected('granola')} />
              </div>
            </aside>
          </div>

          <footer className="action-bar">
            {currentIndex > 0 ? (
              <button className="button ghost" onClick={prevStep}>
                Back
              </button>
            ) : (
              <span />
            )}
            <div>
              {showSkip && (
                <button className="button ghost" onClick={nextStep}>
                  Skip for now
                </button>
              )}
              <button className="button primary" onClick={primaryAction()} disabled={primaryDisabled || loading}>
                {primaryLabel()}
              </button>
            </div>
          </footer>
        </main>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        * {
          box-sizing: border-box;
        }

        html,
        body,
        #__next {
          min-height: 100%;
        }

        body {
          margin: 0;
          background: #f7f8fb;
          color: #111827;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 14px;
          line-height: 1.5;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        button,
        input {
          font: inherit;
        }
      `,
        }}
      />

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .app {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 280px minmax(0, 1fr);
        }

        .rail {
          position: sticky;
          top: 0;
          height: 100vh;
          display: flex;
          flex-direction: column;
          border-right: 1px solid #e5e7eb;
          background: #ffffff;
          padding: 22px 18px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 28px;
        }

        .brand-mark {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: #2563eb;
          color: #ffffff;
          font-weight: 900;
        }

        .brand strong,
        .brand span {
          display: block;
        }

        .brand strong {
          font-size: 15px;
        }

        .brand span {
          color: #6b7280;
          font-size: 12px;
        }

        .progress-block {
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 14px;
          margin-bottom: 18px;
          background: #f9fafb;
        }

        .progress-block > div:first-child {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 10px;
          color: #6b7280;
          font-size: 12px;
          font-weight: 700;
        }

        .progress-block strong {
          color: #111827;
        }

        .progress-track {
          height: 6px;
          overflow: hidden;
          border-radius: 999px;
          background: #e5e7eb;
        }

        .progress-track span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: #2563eb;
          transition: width 180ms ease;
        }

        .step-nav {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .step-nav button {
          position: relative;
          width: 100%;
          display: grid;
          grid-template-columns: 30px 1fr;
          align-items: center;
          gap: 10px;
          border: 0;
          border-radius: 10px;
          background: transparent;
          color: #6b7280;
          cursor: pointer;
          padding: 10px;
          text-align: left;
          transition: background 150ms ease, color 150ms ease;
        }

        .step-nav button:hover:not(:disabled),
        .step-nav button.active {
          background: #eff6ff;
          color: #1d4ed8;
        }

        .step-nav button:disabled {
          cursor: not-allowed;
          opacity: 0.48;
        }

        .step-nav strong,
        .step-nav small {
          display: block;
        }

        .step-nav strong {
          color: inherit;
          font-size: 13px;
          font-weight: 700;
        }

        .step-nav small {
          color: #9ca3af;
          font-size: 11px;
          margin-top: 1px;
        }

        .step-dot {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: #f3f4f6;
          color: #6b7280;
          font-size: 11px;
          font-weight: 800;
        }

        .step-nav button.active .step-dot {
          background: #2563eb;
          color: #ffffff;
        }

        .step-nav button.complete .step-dot {
          background: #059669;
          color: #ffffff;
          font-size: 10px;
        }

        .rail-footer {
          margin-top: auto;
          padding-top: 18px;
          border-top: 1px solid #e5e7eb;
        }

        .rail-footer span,
        .rail-footer a {
          display: block;
          font-size: 12px;
        }

        .rail-footer span {
          color: #6b7280;
          margin-bottom: 4px;
        }

        .rail-footer a {
          color: #2563eb;
          font-weight: 700;
          text-decoration: none;
        }

        .main {
          min-width: 0;
          display: flex;
          flex-direction: column;
          min-height: 100vh;
        }

        .topbar {
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          border-bottom: 1px solid #e5e7eb;
          background: rgba(255, 255, 255, 0.86);
          backdrop-filter: blur(14px);
          padding: 0 32px;
        }

        .topbar span,
        .topbar strong {
          display: block;
        }

        .topbar span {
          color: #6b7280;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .topbar strong {
          color: #111827;
          font-size: 14px;
        }

        .user-chip {
          border: 1px solid #e5e7eb;
          border-radius: 999px;
          background: #ffffff;
          color: #374151;
          padding: 7px 11px;
          font-size: 12px;
          font-weight: 700;
        }

        .toast {
          margin: 24px 32px 0;
          border: 1px solid #bfdbfe;
          border-radius: 10px;
          background: #eff6ff;
          color: #1d4ed8;
          padding: 10px 12px;
          font-size: 13px;
          font-weight: 700;
        }

        .content-grid {
          width: 100%;
          max-width: 1120px;
          margin: 0 auto;
          padding: 42px 32px 28px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 300px;
          gap: 28px;
          align-items: start;
        }

        .primary-pane {
          min-width: 0;
        }

        .hero-copy {
          margin-bottom: 28px;
        }

        .hero-copy span,
        .section-heading span,
        .brief span,
        .action-panel span {
          color: #2563eb;
          display: block;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .hero-copy h1 {
          margin: 8px 0 12px;
          max-width: 720px;
          color: #111827;
          font-size: 44px;
          line-height: 1.03;
          letter-spacing: 0;
        }

        .hero-copy p {
          margin: 0;
          max-width: 680px;
          color: #4b5563;
          font-size: 17px;
        }

        .stack {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .overview-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .intro-tile,
        .setup-section,
        .brief {
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #ffffff;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
        }

        .intro-tile {
          padding: 18px;
        }

        .intro-tile span {
          color: #6b7280;
          display: block;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 10px;
        }

        .intro-tile h3 {
          margin: 0 0 8px;
          color: #111827;
          font-size: 16px;
        }

        .intro-tile p,
        .section-heading p,
        .integration-row p,
        .manual-card p,
        .preference-row p,
        .switch-row p,
        .brief p,
        .action-panel p {
          margin: 0;
          color: #6b7280;
        }

        .timeline {
          display: grid;
          gap: 8px;
        }

        .timeline-item {
          display: flex;
          align-items: center;
          gap: 12px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          background: #ffffff;
          padding: 12px 14px;
        }

        .timeline-item > span {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: #eff6ff;
          color: #2563eb;
          font-size: 12px;
          font-weight: 900;
        }

        .timeline-item strong,
        .timeline-item small {
          display: block;
        }

        .timeline-item small {
          color: #6b7280;
          font-size: 12px;
        }

        .setup-section {
          padding: 22px;
        }

        .section-heading {
          margin-bottom: 18px;
        }

        .section-heading h2,
        .action-panel h2 {
          margin: 6px 0 8px;
          color: #111827;
          font-size: 20px;
          line-height: 1.2;
        }

        .compact-heading {
          margin-bottom: 12px;
        }

        .identity-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }

        .choice-card {
          display: flex;
          align-items: center;
          gap: 14px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          background: #f9fafb;
          color: #111827;
          padding: 14px;
          text-decoration: none;
          transition: border 150ms ease, background 150ms ease;
        }

        .choice-card:hover {
          border-color: #93c5fd;
          background: #eff6ff;
        }

        .choice-card strong,
        .choice-card small {
          display: block;
        }

        .choice-card small,
        .choice-card em {
          color: #6b7280;
          font-size: 12px;
          font-style: normal;
        }

        .choice-card em {
          margin-left: auto;
          color: #2563eb;
          font-weight: 800;
        }

        .choice-icon,
        .integration-mark {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: #dbeafe;
          color: #1d4ed8;
          font-weight: 900;
        }

        .manual-card {
          display: grid;
          gap: 8px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          background: #ffffff;
          padding: 14px;
        }

        .manual-card label,
        .field span {
          color: #374151;
          font-size: 12px;
          font-weight: 800;
        }

        .connected-banner {
          display: flex;
          align-items: center;
          gap: 12px;
          border: 1px solid #a7f3d0;
          border-radius: 12px;
          background: #ecfdf5;
          padding: 14px;
        }

        .connected-banner > span {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: #059669;
        }

        .connected-banner strong,
        .connected-banner p {
          display: block;
          margin: 0;
        }

        .connected-banner p {
          color: #047857;
          font-size: 13px;
        }

        .integration-row {
          display: grid;
          grid-template-columns: 40px 1fr auto;
          align-items: center;
          gap: 14px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          background: #f9fafb;
          padding: 14px;
        }

        .status-pill {
          border-radius: 999px;
          background: #eef2ff;
          color: #4338ca;
          padding: 5px 9px;
          font-size: 11px;
          font-weight: 800;
        }

        .status-pill.connected {
          background: #dcfce7;
          color: #047857;
        }

        .key-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
          margin-top: 12px;
        }

        .benefit-list {
          display: grid;
          gap: 9px;
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .benefit-list li {
          position: relative;
          color: #374151;
          padding-left: 22px;
        }

        .benefit-list li::before {
          content: '';
          position: absolute;
          left: 0;
          top: 8px;
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: #2563eb;
        }

        .field-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .field {
          display: grid;
          gap: 7px;
        }

        .field:last-child {
          grid-column: 1 / -1;
        }

        .field small {
          color: #6b7280;
          font-size: 12px;
        }

        .text-input {
          width: 100%;
          border: 1px solid #d1d5db;
          border-radius: 10px;
          background: #ffffff;
          color: #111827;
          padding: 11px 12px;
          outline: none;
          transition: border 150ms ease, box-shadow 150ms ease;
        }

        .text-input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
        }

        .text-input::placeholder {
          color: #9ca3af;
        }

        .preference-list {
          display: grid;
          gap: 12px;
        }

        .preference-row,
        .switch-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          gap: 18px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          background: #f9fafb;
          padding: 14px;
        }

        .preference-row strong,
        .switch-row strong {
          display: block;
          color: #111827;
        }

        .segmented {
          display: inline-flex;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          background: #ffffff;
          padding: 3px;
        }

        .segmented button {
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: #6b7280;
          cursor: pointer;
          padding: 7px 10px;
          font-size: 12px;
          font-weight: 800;
        }

        .segmented button.active {
          background: #2563eb;
          color: #ffffff;
        }

        .switch-row {
          grid-template-columns: auto minmax(0, 1fr);
          cursor: pointer;
        }

        .switch-row input {
          position: absolute;
          opacity: 0;
          pointer-events: none;
        }

        .switch-track {
          width: 42px;
          height: 24px;
          border-radius: 999px;
          background: #d1d5db;
          padding: 3px;
          transition: background 150ms ease;
        }

        .switch-track span {
          display: block;
          width: 18px;
          height: 18px;
          border-radius: 999px;
          background: #ffffff;
          transition: transform 150ms ease;
        }

        .switch-row input:checked + .switch-track {
          background: #2563eb;
        }

        .switch-row input:checked + .switch-track span {
          transform: translateX(18px);
        }

        .summary-list {
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          overflow: hidden;
        }

        .summary-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 13px 14px;
          border-bottom: 1px solid #e5e7eb;
        }

        .summary-row:last-child {
          border-bottom: 0;
        }

        .summary-row span {
          color: #6b7280;
        }

        .summary-row strong {
          color: #111827;
          text-align: right;
        }

        .action-panel {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
        }

        .return-link {
          color: #2563eb;
          font-weight: 800;
          text-decoration: none;
          white-space: nowrap;
        }

        .brief {
          position: sticky;
          top: 88px;
          display: grid;
          gap: 0;
          overflow: hidden;
        }

        .brief > div {
          padding: 18px;
          border-bottom: 1px solid #e5e7eb;
        }

        .brief > div:last-child {
          border-bottom: 0;
        }

        .brief span {
          color: #6b7280;
          margin-bottom: 8px;
        }

        .connection-line {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 6px 0;
          color: #4b5563;
          font-size: 13px;
        }

        .connection-line strong {
          color: #9ca3af;
          font-size: 12px;
        }

        .connection-line.connected strong {
          color: #059669;
        }

        .action-bar {
          position: sticky;
          bottom: 0;
          margin-top: auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          border-top: 1px solid #e5e7eb;
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(14px);
          padding: 14px 32px;
        }

        .action-bar > div {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 40px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 650;
          padding: 0 16px;
          text-decoration: none;
          transition: background 150ms ease, border 150ms ease, color 150ms ease, box-shadow 150ms ease;
        }

        .button.primary {
          border: 1px solid #2563eb;
          background: #2563eb;
          color: #ffffff;
          box-shadow: 0 1px 2px rgba(37, 99, 235, 0.12);
        }

        .button.primary:hover:not(:disabled) {
          background: #1d4ed8;
          border-color: #1d4ed8;
        }

        .button.secondary {
          border: 1px solid #d1d5db;
          background: #ffffff;
          color: #111827;
        }

        .button.secondary:hover:not(:disabled) {
          border-color: #93c5fd;
          background: #eff6ff;
          color: #1d4ed8;
        }

        .button.ghost {
          border: 1px solid transparent;
          background: transparent;
          color: #4b5563;
          font-weight: 600;
        }

        .button.ghost:hover:not(:disabled) {
          background: #f3f4f6;
          color: #111827;
        }

        .button.compact {
          min-height: 34px;
          border-radius: 7px;
          padding: 0 12px;
          font-size: 13px;
        }

        .button:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        @media (max-width: 980px) {
          .app {
            grid-template-columns: 1fr;
          }

          .rail {
            position: static;
            height: auto;
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(180px, 280px);
            align-items: center;
            gap: 16px;
            border-right: 0;
            border-bottom: 1px solid #e5e7eb;
            padding: 16px 18px;
          }

          .brand,
          .progress-block {
            margin: 0;
          }

          .step-nav,
          .rail-footer {
            display: none;
          }

          .content-grid {
            grid-template-columns: 1fr;
          }

          .brief {
            position: static;
          }
        }

        @media (max-width: 700px) {
          .topbar,
          .action-bar {
            padding-left: 18px;
            padding-right: 18px;
          }

          .rail {
            grid-template-columns: 1fr;
          }

          .content-grid {
            padding: 28px 18px 22px;
          }

          .hero-copy h1 {
            font-size: 32px;
          }

          .overview-grid,
          .field-grid,
          .preference-row,
          .integration-row,
          .key-row {
            grid-template-columns: 1fr;
          }

          .integration-row {
            align-items: start;
          }

          .button.secondary.compact {
            width: 100%;
          }

          .step-nav {
            grid-template-columns: 1fr;
          }

          .action-bar,
          .action-bar > div {
            align-items: stretch;
            flex-direction: column;
          }

          .action-bar .button,
          .action-bar > div {
            width: 100%;
          }

          .segmented {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            width: 100%;
          }
        }
      `,
        }}
      />
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ConnectionLine({ label, connected }: { label: string; connected: boolean }) {
  return (
    <div className={`connection-line ${connected ? 'connected' : ''}`}>
      <span>{label}</span>
      <strong>{connected ? 'Connected' : 'Not connected'}</strong>
    </div>
  );
}
