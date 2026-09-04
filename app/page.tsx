'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Leaf, Pause, Play, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DURATIONS = [15, 25, 45];
const PETALS = ['coral', 'gold', 'violet', 'blue', 'rose'];

type Plant = { id: number; color: string; height: number; lean: number };

type ModelContext = {
  registerTool: (
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => unknown;
    },
    options?: { signal: AbortSignal },
  ) => void | Promise<void>;
};

function makePlant(id: number): Plant {
  return {
    id,
    color: PETALS[id % PETALS.length],
    height: 64 + ((id * 23) % 54),
    lean: ((id * 17) % 15) - 7,
  };
}

export default function Home() {
  const [minutes, setMinutes] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = Number(window.localStorage.getItem('signal-garden-sessions') ?? 0);
    const frame = window.requestAnimationFrame(() => {
      if (Number.isFinite(saved) && saved > 0) setSessions(saved);
      setReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const plant = useCallback(() => {
    setRunning(false);
    setSessions((current) => {
      const next = current + 1;
      window.localStorage.setItem('signal-garden-sessions', String(next));
      return next;
    });
    setSecondsLeft(minutes * 60);
  }, [minutes]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          window.setTimeout(plant, 0);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running, plant]);

  useEffect(() => {
    const modelContext = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    const register = async () => {
      await modelContext.registerTool({
        name: 'start_focus_session',
        title: 'Start a focus session',
        description: 'Choose a supported duration and start the visible Signal Garden timer.',
        inputSchema: {
          type: 'object',
          properties: { minutes: { type: 'integer', enum: DURATIONS } },
          required: ['minutes'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          const duration = (input as { minutes?: number })?.minutes;
          if (!DURATIONS.includes(duration ?? 0)) throw new Error('Minutes must be 15, 25, or 45.');
          setMinutes(duration!);
          setSecondsLeft(duration! * 60);
          setRunning(true);
          return { status: 'started', minutes: duration };
        },
      }, { signal: lifecycle.signal });
      await modelContext.registerTool({
        name: 'complete_focus_session',
        title: 'Complete a focus session',
        description: 'Finish the current session and add one bloom to the visible garden.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute() {
          plant();
          return { status: 'planted' };
        },
      }, { signal: lifecycle.signal });
    };
    void register().catch(() => undefined);
    return () => lifecycle.abort();
  }, [plant]);

  const chooseDuration = (duration: number) => {
    setMinutes(duration);
    setSecondsLeft(duration * 60);
    setRunning(false);
  };

  const reset = () => {
    setRunning(false);
    setSecondsLeft(minutes * 60);
  };

  const plants = useMemo(
    () => Array.from({ length: Math.min(sessions, 18) }, (_, index) => makePlant(index)),
    [sessions],
  );
  const progress = 1 - secondsLeft / (minutes * 60);
  const display = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`;

  return (
    <main className="app-shell">
      <header className="topbar">
        <a href="#timer" className="brand" aria-label="Signal Garden home">
          <span className="brand-mark"><Leaf aria-hidden="true" /></span>
          <span>Signal Garden</span>
        </a>
        <div className="session-count" aria-label={`${sessions} completed focus sessions`}>
          <span className="count-dot" />
          {ready ? sessions : '—'} sessions grown
        </div>
      </header>

      <section className="workspace" id="timer">
        <div className="timer-panel">
          <div className="eyebrow"><Sparkles aria-hidden="true" /> Focus session</div>
          <h1>Give one thing<br />your full attention.</h1>
          <p className="intro">Choose a stretch of time. Every finished session adds a new bloom to your garden.</p>

          <div className="duration-picker" aria-label="Focus duration">
            {DURATIONS.map((duration) => (
              <Button
                key={duration}
                type="button"
                variant={duration === minutes ? 'default' : 'ghost'}
                aria-pressed={duration === minutes}
                onClick={() => chooseDuration(duration)}
                className="duration-button"
              >
                {duration} min
              </Button>
            ))}
          </div>

          <div className="clock-row">
            <div
              className="clock"
              style={{ '--progress': `${progress * 360}deg` } as React.CSSProperties}
              aria-label={`${display} remaining`}
            >
              <div className="clock-face">
                <span className="clock-time">{display}</span>
                <span className="clock-status">{running ? 'growing quietly' : progress > 0 ? 'paused' : 'ready when you are'}</span>
              </div>
            </div>

            <div className="timer-actions">
              <Button type="button" onClick={() => setRunning((value) => !value)} className="start-button">
                {running ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                {running ? 'Pause' : progress > 0 ? 'Continue' : 'Begin focus'}
              </Button>
              <Button type="button" variant="ghost" onClick={reset} className="reset-button">
                <RotateCcw aria-hidden="true" /> Reset timer
              </Button>
            </div>
          </div>
        </div>

        <aside className="garden-panel" aria-labelledby="garden-title">
          <div className="garden-heading">
            <div>
              <p className="eyebrow">Your progress</p>
              <h2 id="garden-title">Today’s garden</h2>
            </div>
            <span className="garden-total">{sessions}</span>
          </div>

          <div className={`garden ${plants.length === 0 ? 'garden-empty' : ''}`}>
            {plants.length === 0 ? (
              <div className="empty-state">
                <span className="empty-seed" />
                <p>Your first bloom is waiting.</p>
                <span>Complete a focus session to plant it.</span>
              </div>
            ) : (
              <div className="plants" aria-label={`${plants.length} blooms`}>
                {plants.map((item, index) => (
                  <div
                    className={`plant plant-${item.color}`}
                    key={item.id}
                    style={{
                      '--height': `${item.height}px`,
                      '--lean': `${item.lean}deg`,
                      '--delay': `${index * 45}ms`,
                    } as React.CSSProperties}
                  >
                    <span className="flower"><i /><i /><i /><i /><b /></span>
                    <span className="stem"><i /></span>
                  </div>
                ))}
              </div>
            )}
            <div className="soil"><span /><span /><span /></div>
          </div>

          <div className="garden-footer">
            <span><Check aria-hidden="true" /> Saved on this device</span>
            <button type="button" onClick={plant}>Finish &amp; plant now</button>
          </div>
        </aside>
      </section>

      <footer>
        <span>Made for one clear thing at a time.</span>
        <span className="footer-seed">✦</span>
      </footer>
    </main>
  );
}
