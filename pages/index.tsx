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
    title: 'Set up the agent that works beside you.',
    summary:
      'This portal connects your work systems, gives the agent basic context about your role, and sets expectations for how it should communicate.',
    why:
      'The agent is most useful when it can see the same signals you already use: Slack identity, calendar and email, code activity, meeting notes, and your current priorities.',
    outcome: 'You will leave with a Slack-ready agent, a saved profile, and a clear next step.',
  },
  {
    key: 'slack',
    label: 'Identity',
    eyebrow: 'Required',
    title: 'Tell the agent who you are in Slack.',
    summary:
      'Slack is the home base. This identity lets the agent recognize your DMs, personalize responses, and route setup data to the right profile.',
    why:
      'Without a Slack user ID, the agent cannot reliably connect these settings to the person who will actually use it.',
    outcome: 'Your profile is anchored to a Slack member ID.',
  },
  {
    key: 'google',
    label: 'Calendar and mail',
    eyebrow: 'Recommended',
    title: 'Connect Google for schedule and inbox context.',
    summary:
      'Google gives the agent enough context to help with calendar questions, meeting prep, follow-ups, and email summaries.',
    why:
      'Most useful agent work starts with time and context: what is coming up, what changed, and what needs attention.',
    outcome: 'The agent can reason over the Google permissions you grant.',
  },
  {
    key: 'github',
    label: 'Code context',
    eyebrow: 'Recommended for builders',
    title: 'Connect GitHub for repo and PR awareness.',
    summary:
      'GitHub lets the agent help with pull requests, code search, issue context, and summaries of engineering work.',
    why:
      'When code activity is connected, the agent can answer questions with project context instead of generic guesses.',
    outcome: 'The agent can reference your connected GitHub workspace.',
  },
  {
    key: 'granola',
    label: 'Meetings',
    eyebrow: 'Optional',
    title: 'Connect Granola for meeting memory.',
    summary:
      'Granola notes help the agent remember decisions, commitments, and follow-ups that usually disappear after a meeting ends.',
    why:
      'Meeting context turns the agent from a question-answering tool into something that can help keep momentum.',
    outcome: 'Meeting notes and action items can become part of the agent context.',
  },
  {
    key: 'profile',
    label: 'Work profile',
    eyebrow: 'Personalization',
    title: 'Give the agent your operating context.',
    summary:
      'A short profile tells the agent what you do, what you are focused on, and what outcomes matter right now.',
    why:
      'The same information can be urgent for one person and noise for another. Your profile helps the agent prioritize.',
    outcome: 'Responses can be tailored to your role, team, timezone, and goals.',
  },
  {
    key: 'style',
    label: 'Behavior',
    eyebrow: 'Preferences',
    title: 'Choose how the agent should show up.',
    summary:
      'Tune response length, proactivity, formatting, and tone so the agent matches your working style from day one.',
    why:
      'A useful agent should not make you repeatedly correct its voice, pacing, or level of detail.',
    outcome: 'Your communication preferences are saved with the profile.',
  },
  {
    key: 'done',
    label: 'Ready',
    eyebrow: 'Complete',
    title: 'Your agent setup is ready.',
    summary:
      'You have created the profile the agent will use when it works with you in Slack and across connected services.',
    why:
      'This summary is your handoff point: what is connected, what was skipped, and how to start using the agent.',
    outcome: 'Start in Slack, then come back anytime to adjust the setup.',
  },
] as const;

type StepKey = (typeof STEPS)[number]['key'];
type ServiceName = 'google' | 'github' | 'granola';

const SERVICE_COPY: Record<
  ServiceName,
  { label: string; gains: string[]; note: string; connectLabel: string }
> = {
  google: {
    label: 'Google',
    gains: [
      'Find open time and understand calendar conflicts',
      'Summarize email threads and surface follow-ups',
      'Use Drive context when files and projects matter',
    ],
    note: 'You stay in control of the permissions granted in the Google consent screen.',
    connectLabel: 'Connect Google',
  },
  github: {
    label: 'GitHub',
    gains: [
      'Review and summarize pull requests',
      'Search code and explain project structure',
      'Track issues and changes across repositories',
    ],
    note: 'Use the OAuth prompt to grant repo access appropriate for your work.',
    connectLabel: 'Connect GitHub',
  },
  granola: {
    label: 'Granola',
    gains: [
      'Summarize meeting notes and transcripts',
      'Recover decisions from past conversations',
      'Track action items without manual copy-paste',
    ],
    note: 'Paste your Granola API key only if you want meeting memory connected now.',
    connectLabel: 'Save Granola key',
  },
};

const PROFILE_FIELDS = [
  { key: 'role', label: 'Role', placeholder: 'Product Engineer', hint: 'What should the agent assume you are responsible for?' },
  { key: 'team', label: 'Team', placeholder: 'Marketplace', hint: 'Which group should context be organized around?' },
  { key: 'timezone', label: 'Timezone', placeholder: 'America/Los_Angeles', hint: 'Used for briefings, reminders, and scheduling.' },
  { key: 'focus', label: 'Current focus', placeholder: 'Q2 planning, auction model', hint: 'The top one or two things you are actively driving.' },
  { key: 'goals', label: 'Goals', placeholder: 'Ship auction V2 by end of month', hint: 'Outcomes the agent should help protect.' },
] as const;

const STYLE_FIELDS = [
  {
    key: 'verbosity',
    label: 'Response depth',
    desc: 'How much context should the agent include by default?',
    options: [
      { value: 'concise', label: 'Concise' },
      { value: 'detailed', label: 'Detailed' },
    ],
  },
  {
    key: 'proactivity',
    label: 'Initiative',
    desc: 'How often should the agent suggest next steps?',
    options: [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Balanced' },
      { value: 'high', label: 'High' },
    ],
  },
  {
    key: 'format',
    label: 'Structure',
    desc: 'How should longer answers be organized?',
    options: [
      { value: 'bullets', label: 'Bullets' },
      { value: 'paragraphs', label: 'Paragraphs' },
      { value: 'mixed', label: 'Mixed' },
    ],
  },
] as const;

export default function Home() {
  const [userId, setUserId] = useState(() => getUrlParam('id') || getUrlParam('userId') || '');
  const [userName] = useState(() => getUrlParam('name') || '');
  const [step, setStep] = useState<StepKey>('welcome');
  const [services, setServices] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [granolaKey, setGranolaKey] = useState('');
  const [granolaSaved, setGranolaSaved] = useState(false);
  const [profile, setProfile] = useState({
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

  const currentStepIndex = STEPS.findIndex((item) => item.key === step);
  const currentStep = STEPS[currentStepIndex];
  const completedCount = useMemo(() => {
    let count = currentStepIndex;
    if (step === 'done') count = STEPS.length;
    return Math.max(0, count);
  }, [currentStepIndex, step]);
  const progress = Math.round((completedCount / (STEPS.length - 1)) * 100);

  const goTo = useCallback((nextStep: StepKey) => {
    setStep(nextStep);
    setMessage('');
  }, []);

  const nextStep = useCallback(() => {
    const currentIdx = STEPS.findIndex((item) => item.key === step);
    if (currentIdx < STEPS.length - 1) {
      goTo(STEPS[currentIdx + 1].key);
    }
  }, [goTo, step]);

  const prevStep = useCallback(() => {
    const currentIdx = STEPS.findIndex((item) => item.key === step);
    if (currentIdx > 0) {
      goTo(STEPS[currentIdx - 1].key);
    }
  }, [goTo, step]);

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

  const connectOAuth = (service: ServiceName) => {
    if (!userId) {
      setMessage('Add your Slack User ID first so this connection can be saved to your profile.');
      goTo('slack');
      return;
    }

    const popup = window.open(
      `/api/oauth/${service}?user=${userId}`,
      `${service}-oauth`,
      'width=600,height=700'
    );

    if (!popup) {
      setMessage('Please allow popups for this site, then try the connection again.');
      return;
    }

    setMessage(`A ${SERVICE_COPY[service].label} approval window opened.`);
  };

  const saveGranolaKey = async () => {
    if (!granolaKey.trim()) return;
    if (!userId) {
      setMessage('Add your Slack User ID first so the Granola key is saved to the right profile.');
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
      setMessage('Granola key could not be saved. You can skip it and connect later.');
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
      setMessage('Setup saved locally. The profile webhook did not respond.');
    }
    setLoading(false);
    goTo('done');
  };

  const canOpenStep = (targetIndex: number) => {
    if (targetIndex <= currentStepIndex) return true;
    if (STEPS[targetIndex].key === 'done') return step === 'done';
    if (STEPS[targetIndex].key !== 'slack' && !userId) return false;
    return true;
  };

  const statusForService = (service: ServiceName) => {
    if (service === 'granola') return granolaSaved || services.granola;
    return services[service];
  };

  const renderServiceStep = (service: ServiceName) => {
    const copy = SERVICE_COPY[service];
    const connected = statusForService(service);

    return (
      <div className="section-stack">
        <div className="decision-panel">
          <div>
            <p className="panel-kicker">What this unlocks</p>
            <h3>{copy.label} context</h3>
          </div>
          <ul className="check-list">
            {copy.gains.map((gain) => (
              <li key={gain}>{gain}</li>
            ))}
          </ul>
          <p className="fine-print">{copy.note}</p>
        </div>

        {connected ? (
          <div className="state-row success">
            <span className="state-dot" />
            <span>{copy.label} is connected.</span>
          </div>
        ) : service === 'granola' ? (
          <div className="form-block">
            <label className="field-label" htmlFor="granola-key">
              Granola API key
            </label>
            <input
              id="granola-key"
              type="password"
              placeholder="Paste your Granola API key"
              value={granolaKey}
              onChange={(event) => setGranolaKey(event.target.value)}
              className="text-input"
            />
            <p className="field-hint">Find it in Granola Settings, then API.</p>
            <button
              onClick={saveGranolaKey}
              disabled={!granolaKey.trim() || loading}
              className="btn-secondary"
            >
              {loading ? 'Saving...' : copy.connectLabel}
            </button>
          </div>
        ) : (
          <button onClick={() => connectOAuth(service)} className="connect-button">
            <span>{copy.connectLabel}</span>
            <span className="button-detail">Opens secure approval</span>
          </button>
        )}

        <div className="choice-row">
          <button onClick={prevStep} className="btn-quiet">
            Back
          </button>
          <div className="choice-actions">
            {!connected && (
              <button onClick={nextStep} className="btn-text">
                Skip for now
              </button>
            )}
            <button onClick={nextStep} className="btn-primary">
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderStep = () => {
    switch (step) {
      case 'welcome':
        return (
          <div className="section-stack">
            <div className="intro-grid">
              <div>
                <p className="panel-kicker">Setup path</p>
                <h3>What you are building</h3>
                <p>
                  A personal agent profile that ties together your identity, connected tools,
                  priorities, and communication preferences.
                </p>
              </div>
              <div>
                <p className="panel-kicker">Time needed</p>
                <h3>About five minutes</h3>
                <p>
                  Slack is required. Google, GitHub, and Granola can be connected now or skipped
                  until you are ready.
                </p>
              </div>
            </div>
            <div className="flow-preview">
              {STEPS.slice(1, -1).map((item) => (
                <div key={item.key} className="flow-item">
                  <span>{item.label}</span>
                  <small>{item.eyebrow}</small>
                </div>
              ))}
            </div>
            <div className="choice-row">
              <span className="microcopy">You can change these settings later.</span>
              <button onClick={() => goTo('slack')} className="btn-primary">
                Begin setup
              </button>
            </div>
          </div>
        );

      case 'slack':
        return (
          <div className="section-stack">
            <div className="decision-panel">
              <div>
                <p className="panel-kicker">Required first</p>
                <h3>Slack is the account anchor</h3>
              </div>
              <p>
                Every connection in this setup is saved against your Slack identity. The agent uses
                it to know when a message, briefing, or saved preference belongs to you.
              </p>
            </div>

            {!userId ? (
              <div className="identity-options">
                <a
                  href={`https://slack.com/openid/connect/authorize?response_type=code&client_id=879184060177.11209135000535&scope=openid,profile,email&redirect_uri=${encodeURIComponent(
                    'https://disco-agent-portal.vercel.app/api/oauth/slack'
                  )}`}
                  className="connect-button"
                >
                  <span>Sign in with Slack</span>
                  <span className="button-detail">Recommended</span>
                </a>
                <div className="manual-entry">
                  <label className="field-label" htmlFor="slack-id">
                    Or enter Slack member ID
                  </label>
                  <input
                    id="slack-id"
                    placeholder="Example: URTU2JQCT"
                    onChange={(event) => setUserId(event.target.value.trim())}
                    className="text-input"
                  />
                  <p className="field-hint">Slack profile, more menu, Copy member ID.</p>
                </div>
              </div>
            ) : (
              <div className="state-row success">
                <span className="state-dot" />
                <span>
                  Slack identity saved as <strong>{userId}</strong>.
                </span>
              </div>
            )}

            <div className="choice-row">
              <button onClick={prevStep} className="btn-quiet">
                Back
              </button>
              <button onClick={nextStep} disabled={!userId} className="btn-primary">
                Continue
              </button>
            </div>
          </div>
        );

      case 'google':
        return renderServiceStep('google');

      case 'github':
        return renderServiceStep('github');

      case 'granola':
        return renderServiceStep('granola');

      case 'profile':
        return (
          <div className="section-stack">
            <div className="decision-panel">
              <div>
                <p className="panel-kicker">Personal context</p>
                <h3>Help the agent filter what matters</h3>
              </div>
              <p>
                These answers become defaults for prioritization, reminders, summaries, and the
                way the agent frames recommendations.
              </p>
            </div>
            <div className="profile-grid">
              {PROFILE_FIELDS.map((field) => (
                <div key={field.key} className="field">
                  <label className="field-label" htmlFor={field.key}>
                    {field.label}
                  </label>
                  <input
                    id={field.key}
                    value={profile[field.key]}
                    onChange={(event) =>
                      setProfile({ ...profile, [field.key]: event.target.value })
                    }
                    placeholder={field.placeholder}
                    className="text-input"
                  />
                  <p className="field-hint">{field.hint}</p>
                </div>
              ))}
            </div>
            <div className="choice-row">
              <button onClick={prevStep} className="btn-quiet">
                Back
              </button>
              <button onClick={nextStep} className="btn-primary">
                Continue
              </button>
            </div>
          </div>
        );

      case 'style':
        return (
          <div className="section-stack">
            <div className="decision-panel">
              <div>
                <p className="panel-kicker">Agent behavior</p>
                <h3>Set the default working style</h3>
              </div>
              <p>
                These preferences shape day-to-day answers. They are intentionally practical:
                depth, initiative, structure, and tone.
              </p>
            </div>
            <div className="preference-stack">
              {STYLE_FIELDS.map((field) => (
                <div key={field.key} className="preference-row">
                  <div>
                    <label className="field-label">{field.label}</label>
                    <p className="field-hint">{field.desc}</p>
                  </div>
                  <div className="segmented-control">
                    {field.options.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setStyle({ ...style, [field.key]: option.value })}
                        className={style[field.key] === option.value ? 'selected' : ''}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={style.emoji}
                  onChange={(event) => setStyle({ ...style, emoji: event.target.checked })}
                />
                <span className="toggle-track">
                  <span className="toggle-thumb" />
                </span>
                <span>
                  <strong>Allow emoji</strong>
                  <small>Use sparingly when it fits the conversation.</small>
                </span>
              </label>
            </div>
            <div className="choice-row">
              <button onClick={prevStep} className="btn-quiet">
                Back
              </button>
              <button onClick={submitOnboarding} className="btn-primary">
                {loading ? 'Saving...' : 'Finish setup'}
              </button>
            </div>
          </div>
        );

      case 'done':
        return (
          <div className="section-stack">
            <div className="summary-grid">
              <div className="summary-block">
                <p className="panel-kicker">Profile</p>
                <h3>{profile.role || 'Role not set'}</h3>
                <p>{profile.team || 'No team added'} / {profile.timezone}</p>
              </div>
              <div className="summary-block">
                <p className="panel-kicker">Style</p>
                <h3>{style.verbosity} / {style.proactivity}</h3>
                <p>{style.format} format / emoji {style.emoji ? 'allowed' : 'off'}</p>
              </div>
            </div>
            <div className="connection-summary">
              {(['google', 'github', 'granola'] as ServiceName[]).map((service) => (
                <div key={service} className="summary-row">
                  <span>{SERVICE_COPY[service].label}</span>
                  <strong>{statusForService(service) ? 'Connected' : 'Skipped'}</strong>
                </div>
              ))}
              <div className="summary-row">
                <span>Slack</span>
                <strong>{userId}</strong>
              </div>
            </div>
            <div className="decision-panel">
              <div>
                <p className="panel-kicker">Start using it</p>
                <h3>Open Slack and DM @gruv</h3>
              </div>
              <p>
                Ask for a briefing, request help with a PR, or have it summarize what needs your
                attention today. Bookmark this setup link if you want to adjust preferences later.
              </p>
              <a href={`/?id=${userId}`} className="bookmark-link">
                disco-agent-portal.vercel.app/?id={userId}
              </a>
            </div>
            <div className="choice-row">
              <button onClick={prevStep} className="btn-quiet">
                Back
              </button>
              <button onClick={() => goTo('welcome')} className="btn-secondary">
                Review setup
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <div className="app-shell">
        <header className="topbar">
          <div>
            <p className="product-kicker">Disco Agent Portal</p>
            <span>Agent onboarding</span>
          </div>
          {userId && <div className="user-chip">{userId}</div>}
        </header>

        <main className="setup-layout">
          <aside className="setup-rail" aria-label="Setup progress">
            <div className="progress-card">
              <div className="progress-copy">
                <span>Setup progress</span>
                <strong>{progress}%</strong>
              </div>
              <div className="progress-track">
                <span style={{ width: `${progress}%` }} />
              </div>
            </div>

            <ol className="step-list">
              {STEPS.map((item, index) => {
                const isCurrent = item.key === step;
                const isComplete = index < currentStepIndex || step === 'done';
                const isLocked = !canOpenStep(index);

                return (
                  <li key={item.key}>
                    <button
                      onClick={() => !isLocked && goTo(item.key)}
                      disabled={isLocked}
                      className={`${isCurrent ? 'current' : ''} ${isComplete ? 'complete' : ''}`}
                    >
                      <span className="step-marker">{isComplete ? 'OK' : index + 1}</span>
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.eyebrow}</small>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </aside>

          <section className="workspace">
            {message && <div className="toast">{message}</div>}
            <div className="step-header">
              <p className="step-eyebrow">{currentStep.eyebrow}</p>
              <h1>{currentStep.title}</h1>
              <p>{currentStep.summary}</p>
            </div>
            <div className="explain-strip">
              <div>
                <span>Why this matters</span>
                <p>{currentStep.why}</p>
              </div>
              <div>
                <span>Outcome</span>
                <p>{currentStep.outcome}</p>
              </div>
            </div>
            {renderStep()}
          </section>
        </main>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

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
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: #f4f2ee;
          color: #20211f;
          font-size: 15px;
          line-height: 1.5;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        button,
        input {
          font: inherit;
        }
      `}</style>

      <style jsx>{`
        .app-shell {
          min-height: 100vh;
          padding: 28px;
        }

        .topbar {
          max-width: 1180px;
          margin: 0 auto 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .topbar div:first-child {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .product-kicker,
        .panel-kicker,
        .step-eyebrow {
          margin: 0;
          color: #76736b;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .topbar span {
          color: #20211f;
          font-size: 18px;
          font-weight: 800;
        }

        .user-chip {
          border: 1px solid #d8d2c8;
          background: #ffffff;
          color: #4c4a45;
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 13px;
          font-weight: 700;
        }

        .setup-layout {
          max-width: 1180px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(240px, 300px) minmax(0, 1fr);
          gap: 18px;
          align-items: start;
        }

        .setup-rail,
        .workspace {
          background: #ffffff;
          border: 1px solid #d8d2c8;
          border-radius: 8px;
          box-shadow: 0 18px 50px rgba(53, 47, 39, 0.08);
        }

        .setup-rail {
          position: sticky;
          top: 20px;
          padding: 16px;
        }

        .workspace {
          min-height: 680px;
          padding: 34px;
        }

        .progress-card {
          border-bottom: 1px solid #ebe6df;
          padding-bottom: 16px;
          margin-bottom: 14px;
        }

        .progress-copy {
          display: flex;
          justify-content: space-between;
          color: #5c5850;
          font-size: 13px;
          margin-bottom: 10px;
        }

        .progress-copy strong {
          color: #20211f;
        }

        .progress-track {
          height: 8px;
          background: #ece7de;
          border-radius: 999px;
          overflow: hidden;
        }

        .progress-track span {
          display: block;
          height: 100%;
          background: #246b5f;
          border-radius: inherit;
          transition: width 180ms ease;
        }

        .step-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin: 0;
          padding: 0;
        }

        .step-list button {
          width: 100%;
          display: grid;
          grid-template-columns: 30px 1fr;
          gap: 10px;
          align-items: center;
          border: 0;
          background: transparent;
          color: #5c5850;
          text-align: left;
          border-radius: 6px;
          padding: 10px;
          cursor: pointer;
        }

        .step-list button:hover:not(:disabled),
        .step-list button.current {
          background: #f3f0ea;
          color: #20211f;
        }

        .step-list button:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .step-marker {
          width: 28px;
          height: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          border: 1px solid #d8d2c8;
          background: #ffffff;
          color: #76736b;
          font-size: 12px;
          font-weight: 800;
        }

        .step-list button.current .step-marker,
        .step-list button.complete .step-marker {
          background: #246b5f;
          border-color: #246b5f;
          color: #ffffff;
        }

        .step-list strong,
        .step-list small {
          display: block;
        }

        .step-list strong {
          font-size: 14px;
        }

        .step-list small {
          color: #8b877e;
          font-size: 12px;
          margin-top: 1px;
        }

        .toast {
          border: 1px solid #b9d3cc;
          background: #eef8f5;
          color: #285a50;
          border-radius: 6px;
          padding: 10px 12px;
          margin-bottom: 18px;
          font-size: 13px;
          font-weight: 700;
        }

        .step-header {
          max-width: 740px;
          margin-bottom: 22px;
        }

        .step-header h1 {
          margin: 8px 0 12px;
          color: #20211f;
          font-size: 42px;
          line-height: 1.04;
          letter-spacing: 0;
        }

        .step-header p:last-child {
          margin: 0;
          color: #5c5850;
          font-size: 17px;
          max-width: 680px;
        }

        .explain-strip {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1px;
          overflow: hidden;
          border: 1px solid #e3ddd3;
          border-radius: 8px;
          background: #e3ddd3;
          margin-bottom: 28px;
        }

        .explain-strip div {
          background: #fbfaf8;
          padding: 18px;
        }

        .explain-strip span {
          color: #76736b;
          display: block;
          font-size: 12px;
          font-weight: 800;
          margin-bottom: 6px;
        }

        .explain-strip p {
          margin: 0;
          color: #4c4a45;
        }

        .section-stack {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .intro-grid,
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .intro-grid > div,
        .summary-block,
        .decision-panel,
        .form-block,
        .connection-summary {
          border: 1px solid #e3ddd3;
          border-radius: 8px;
          background: #fbfaf8;
          padding: 18px;
        }

        .intro-grid h3,
        .summary-block h3,
        .decision-panel h3 {
          margin: 6px 0 8px;
          color: #20211f;
          font-size: 18px;
        }

        .intro-grid p,
        .summary-block p,
        .decision-panel p,
        .fine-print {
          margin: 0;
          color: #5c5850;
        }

        .flow-preview {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .flow-item {
          border-left: 3px solid #246b5f;
          background: #f5f2ec;
          border-radius: 6px;
          padding: 12px;
        }

        .flow-item span,
        .flow-item small {
          display: block;
        }

        .flow-item span {
          color: #20211f;
          font-weight: 800;
        }

        .flow-item small {
          color: #76736b;
          margin-top: 2px;
        }

        .decision-panel {
          display: grid;
          gap: 14px;
        }

        .check-list {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 8px;
        }

        .check-list li {
          position: relative;
          color: #4c4a45;
          padding-left: 24px;
        }

        .check-list li::before {
          content: '';
          position: absolute;
          left: 0;
          top: 8px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #246b5f;
        }

        .fine-print {
          color: #76736b;
          font-size: 13px;
        }

        .connect-button {
          width: 100%;
          border: 1px solid #cfc7bb;
          background: #ffffff;
          color: #20211f;
          border-radius: 8px;
          padding: 16px 18px;
          text-decoration: none;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          cursor: pointer;
          font-weight: 800;
        }

        .connect-button:hover {
          border-color: #246b5f;
          box-shadow: inset 0 0 0 1px #246b5f;
        }

        .button-detail {
          color: #76736b;
          font-size: 13px;
          font-weight: 700;
        }

        .identity-options {
          display: grid;
          gap: 12px;
        }

        .manual-entry,
        .field {
          display: grid;
          gap: 6px;
        }

        .field-label {
          color: #20211f;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .field-hint {
          margin: 0;
          color: #76736b;
          font-size: 13px;
        }

        .text-input {
          width: 100%;
          border: 1px solid #cfc7bb;
          background: #ffffff;
          color: #20211f;
          border-radius: 6px;
          padding: 12px 13px;
          outline: none;
        }

        .text-input:focus {
          border-color: #246b5f;
          box-shadow: 0 0 0 3px rgba(36, 107, 95, 0.14);
        }

        .state-row {
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid #d7e6df;
          background: #f1faf6;
          color: #285a50;
          border-radius: 8px;
          padding: 14px 16px;
          font-weight: 700;
        }

        .state-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #246b5f;
        }

        .profile-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .profile-grid .field:last-child {
          grid-column: 1 / -1;
        }

        .preference-stack {
          display: grid;
          gap: 12px;
        }

        .preference-row,
        .toggle-row {
          border: 1px solid #e3ddd3;
          border-radius: 8px;
          background: #fbfaf8;
          padding: 16px;
        }

        .preference-row {
          display: grid;
          grid-template-columns: minmax(160px, 1fr) auto;
          gap: 16px;
          align-items: center;
        }

        .segmented-control {
          display: inline-flex;
          border: 1px solid #cfc7bb;
          border-radius: 7px;
          padding: 3px;
          background: #ffffff;
        }

        .segmented-control button {
          border: 0;
          background: transparent;
          color: #5c5850;
          border-radius: 5px;
          padding: 8px 11px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 800;
        }

        .segmented-control button.selected {
          background: #246b5f;
          color: #ffffff;
        }

        .toggle-row {
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
        }

        .toggle-row input {
          position: absolute;
          opacity: 0;
          pointer-events: none;
        }

        .toggle-track {
          width: 42px;
          height: 24px;
          border-radius: 999px;
          background: #cfc7bb;
          padding: 3px;
          transition: background 160ms ease;
        }

        .toggle-thumb {
          display: block;
          width: 18px;
          height: 18px;
          background: #ffffff;
          border-radius: 50%;
          transition: transform 160ms ease;
        }

        .toggle-row input:checked + .toggle-track {
          background: #246b5f;
        }

        .toggle-row input:checked + .toggle-track .toggle-thumb {
          transform: translateX(18px);
        }

        .toggle-row strong,
        .toggle-row small {
          display: block;
        }

        .toggle-row small {
          color: #76736b;
          margin-top: 2px;
        }

        .connection-summary {
          display: grid;
          gap: 0;
          padding: 0;
          overflow: hidden;
        }

        .summary-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 14px 16px;
          border-bottom: 1px solid #e8e2d9;
        }

        .summary-row:last-child {
          border-bottom: 0;
        }

        .summary-row span {
          color: #5c5850;
        }

        .summary-row strong {
          color: #20211f;
        }

        .bookmark-link {
          color: #246b5f;
          font-weight: 800;
          word-break: break-word;
        }

        .choice-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding-top: 4px;
        }

        .choice-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .microcopy {
          color: #76736b;
          font-size: 13px;
        }

        .btn-primary,
        .btn-secondary,
        .btn-quiet,
        .btn-text {
          border-radius: 6px;
          cursor: pointer;
          font-weight: 800;
          min-height: 42px;
          padding: 0 16px;
        }

        .btn-primary {
          border: 1px solid #246b5f;
          background: #246b5f;
          color: #ffffff;
        }

        .btn-primary:hover {
          background: #1e5a50;
        }

        .btn-primary:disabled,
        .btn-secondary:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .btn-secondary {
          border: 1px solid #cfc7bb;
          background: #ffffff;
          color: #20211f;
        }

        .btn-secondary:hover,
        .btn-quiet:hover,
        .btn-text:hover {
          background: #f3f0ea;
        }

        .btn-quiet,
        .btn-text {
          border: 1px solid transparent;
          background: transparent;
          color: #5c5850;
        }

        .btn-text {
          color: #246b5f;
        }

        @media (max-width: 900px) {
          .app-shell {
            padding: 18px;
          }

          .setup-layout {
            grid-template-columns: 1fr;
          }

          .setup-rail {
            position: static;
          }

          .step-list {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .workspace {
            min-height: 0;
          }
        }

        @media (max-width: 680px) {
          .app-shell {
            padding: 12px;
          }

          .topbar {
            align-items: flex-start;
            flex-direction: column;
          }

          .workspace {
            padding: 22px;
          }

          .step-header h1 {
            font-size: 32px;
          }

          .explain-strip,
          .intro-grid,
          .summary-grid,
          .profile-grid,
          .preference-row {
            grid-template-columns: 1fr;
          }

          .flow-preview,
          .step-list {
            grid-template-columns: 1fr;
          }

          .choice-row,
          .choice-actions {
            align-items: stretch;
            flex-direction: column;
          }

          .choice-row > *,
          .choice-actions,
          .choice-actions > *,
          .btn-primary,
          .btn-secondary,
          .btn-quiet,
          .btn-text {
            width: 100%;
          }

          .segmented-control {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            width: 100%;
          }

          .segmented-control button {
            padding-left: 6px;
            padding-right: 6px;
          }
        }
      `}</style>
    </>
  );
}
