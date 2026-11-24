import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { QueryState } from '../components/Shell.jsx';

const activities = [
  { id: 'garden-explorer', title: 'Explore a living garden', topic: '3D scene · camera · materials · lighting', description: 'Inspect a small garden, switch viewpoints, and discover how water, soil, and sunlight support healthy plants.' },
  { id: 'sort-the-garden', title: 'Sort the garden', topic: 'Interaction · prefabs · feedback', description: 'Place everyday items in the right cleanup bins and learn what belongs in compost, recycling, or landfill.' },
  { id: 'cleanup-rush', title: 'Cleanup rush', topic: 'Timed interaction · game loop', description: 'Tap visible litter before time runs out. A short, keyboard-friendly game inspired by Whack-a-Mole.' },
  { id: 'learning-garden-agent', title: 'Train a garden helper', topic: 'Reinforcement learning · Q-learning', description: 'Watch a tiny agent learn a route to water a thirsty plant, then inspect its learned policy.' },
];

function Completion({ complete, completed, retry, failed }) {
  return <div className="banner" role="status">{completed ? 'Activity complete — saved to your learning progress.' : complete ? 'Saving your completion…' : failed ? <span>Activity finished, but progress could not be saved. <button className="secondary" onClick={retry}>Retry save</button></span> : 'Finish the activity to save your progress. Activities do not award eco-points.'}</div>;
}

export function ActivitiesPage() {
  const progress = useQuery({ queryKey: ['activity-progress'], queryFn: () => api('/activities/progress') });
  const completed = new Set(progress.data?.items?.map((item) => item.activityId) ?? []);
  return (
    <div className="stack">
      <p className="kicker">Interactive learning</p><h1>Learn by doing</h1>
      <p className="muted">Four short activities connect environmental learning with interactive 3D, game design, and a simple learning agent.</p>
      <QueryState query={progress}>{() => <div className="grid activity-grid">{activities.map((activity) => <article className="card activity-card" key={activity.id}>
        <p className="kicker">{activity.topic}</p><h2>{activity.title}</h2><p>{activity.description}</p>
        <div className="spread wrap"><span className="muted">{completed.has(activity.id) ? 'Completed' : 'Not started'}</span><Link className="button" to={`/learn/activities/${activity.id}`}>{completed.has(activity.id) ? 'Play again' : 'Start activity'}</Link></div>
      </article>)}</div>}</QueryState>
    </div>
  );
}

function GardenExplorer({ onComplete, busy, completed, failed }) {
  const [view, setView] = useState(0);
  const [found, setFound] = useState([]);
  const labels = ['Soil', 'Sunlight', 'Water'];
  const inspect = (thing) => {
    if (found.includes(thing)) return;
    const next = [...found, thing];
    setFound(next);
    if (next.length === labels.length) onComplete();
  };
  return <div className="stack">
    <p>Use the viewpoint controls to look around, then select the three garden features in the scene.</p>
    <div className={`garden-stage view-${view}`} aria-label={`Interactive garden, viewpoint ${view + 1}`}>
      <div className="garden-sky" /><div className="garden-sun" aria-hidden="true">☀</div>
      <button className="garden-feature garden-soil" onClick={() => inspect('Soil')} aria-label="Inspect soil">🌱<span>Soil</span></button>
      <button className="garden-feature garden-water" onClick={() => inspect('Water')} aria-label="Inspect water">💧<span>Water</span></button>
      <button className="garden-feature garden-light" onClick={() => inspect('Sunlight')} aria-label="Inspect sunlight">🌞<span>Sunlight</span></button>
      <div className="garden-bed" aria-hidden="true"><i>🌿</i><i>🌱</i><i>🌿</i></div>
    </div>
    <div className="row wrap" aria-label="Garden viewpoint controls">{['Front', 'Side', 'Top'].map((name, i) => <button key={name} className={view === i ? '' : 'secondary'} onClick={() => setView(i)} aria-pressed={view === i}>{name} view</button>)}</div>
    <p className="muted">Features found: {found.length} / {labels.length}{found.length ? ` · ${found.join(', ')}` : ''}</p>
    <Completion complete={busy} completed={completed} retry={onComplete} failed={failed} />
  </div>;
}

const sortItems = [
  { name: 'Banana peel', bin: 'Compost', icon: '🍌' }, { name: 'Glass jar', bin: 'Recycle', icon: '🫙' },
  { name: 'Plastic wrapper', bin: 'Landfill', icon: '🧃' }, { name: 'Dry leaves', bin: 'Compost', icon: '🍂' },
];
function SortGarden({ onComplete, busy, completed, failed }) {
  const [index, setIndex] = useState(0); const [message, setMessage] = useState(''); const [mistakes, setMistakes] = useState(0);
  const choose = (bin) => {
    if (bin !== sortItems[index].bin) { setMistakes((n) => n + 1); setMessage(`Try again: ${sortItems[index].name} has a different best-fit bin.`); return; }
    const next = index + 1; setMessage(`${sortItems[index].name} goes in ${bin.toLowerCase()}.`); setIndex(next);
    if (next === sortItems.length) onComplete();
  };
  return <div className="stack"><p>Choose a bin for each item. These are simplified examples; local recycling rules can vary.</p>
    {index < sortItems.length ? <div className="card sort-card" aria-live="polite"><span className="sort-icon" aria-hidden="true">{sortItems[index].icon}</span><h2>{sortItems[index].name}</h2><p>Item {index + 1} of {sortItems.length}</p><div className="row wrap">{['Compost', 'Recycle', 'Landfill'].map((bin) => <button className="secondary" key={bin} onClick={() => choose(bin)}>{bin}</button>)}</div></div> : <div className="banner">All items sorted. {mistakes ? `You learned through ${mistakes} retries.` : 'Perfect round!'}</div>}
    {message && <p role="status">{message}</p>}<Completion complete={busy} completed={completed} retry={onComplete} failed={failed} />
  </div>;
}

function CleanupRush({ onComplete, busy, completed, failed }) {
  const [running, setRunning] = useState(false); const [time, setTime] = useState(20); const [score, setScore] = useState(0); const [target, setTarget] = useState(0);
  useEffect(() => { if (!running) return undefined; const timer = window.setInterval(() => setTime((n) => Math.max(0, n - 1)), 1000); return () => window.clearInterval(timer); }, [running]);
  useEffect(() => { if (running && time === 0) { setRunning(false); onComplete(); } }, [running, time]);
  const start = () => { setScore(0); setTime(20); setTarget(Math.floor(Math.random() * 9)); setRunning(true); };
  return <div className="stack"><p>Start a 20-second round. Select the litter as it appears; every target works with keyboard or touch.</p><div className="spread"><strong>Time: {time}s</strong><strong>Cleaned: {score}</strong></div>
    <div className="cleanup-grid" aria-label="Cleanup game board">{Array.from({ length: 9 }, (_, i) => <button key={i} className="cleanup-cell secondary" disabled={!running} aria-label={i === target && running ? 'Pick up litter' : `Garden spot ${i + 1}`} onClick={() => { if (i === target) { setScore((n) => n + 1); setTarget(Math.floor(Math.random() * 9)); } }}>{i === target && running ? '🧴' : '🌿'}</button>)}</div>
    {!running && <button onClick={start}>{time === 0 ? 'Play again' : 'Start 20-second round'}</button>}<p aria-live="polite">{running ? 'Litter is appearing in the garden.' : time === 0 ? `Round complete. You cleaned ${score} items.` : 'Ready when you are.'}</p><Completion complete={busy} completed={completed} retry={onComplete} failed={failed} />
  </div>;
}

const MOVES = [[-1, 0, '↑'], [0, 1, '→'], [1, 0, '↓'], [0, -1, '←']];
function trainAgent() {
  const q = Array.from({ length: 9 }, () => [0, 0, 0, 0]); const goal = 8;
  for (let episode = 0; episode < 500; episode += 1) {
    let state = Math.floor(Math.random() * 8);
    for (let step = 0; step < 30 && state !== goal; step += 1) {
      const [dr, dc] = MOVES[Math.random() < 0.12 ? Math.floor(Math.random() * 4) : q[state].indexOf(Math.max(...q[state]))];
      const row = Math.floor(state / 3); const col = state % 3;
      const next = Math.max(0, Math.min(2, row + dr)) * 3 + Math.max(0, Math.min(2, col + dc));
      const reward = next === goal ? 10 : -0.1;
      const action = MOVES.findIndex(([r, c]) => r === dr && c === dc);
      q[state][action] += 0.25 * (reward + 0.85 * Math.max(...q[next]) - q[state][action]);
      state = next;
    }
  }
  return q;
}
function LearningAgent({ onComplete, busy, completed, failed }) {
  const [q, setQ] = useState(null); const [trained, setTrained] = useState(false);
  const policy = useMemo(() => q?.map((values, state) => state === 8 ? '🌱' : MOVES[values.indexOf(Math.max(...values))][2]), [q]);
  const run = () => { setQ(trainAgent()); setTrained(true); onComplete(); };
  return <div className="stack"><p>The agent uses Q-learning: it explores moves, receives a reward for reaching the thirsty plant, and updates estimates of which actions are useful.</p>
    <div className="agent-board" role="img" aria-label={trained ? 'Learned policy pointing toward the plant' : 'Garden grid with a thirsty plant at bottom right'}>{Array.from({ length: 9 }, (_, i) => <div className="agent-cell" key={i}>{i === 8 ? '🌱' : trained ? policy[i] : '·'}</div>)}</div>
    <p>{trained ? 'Policy learned from 500 short training episodes. Arrows show the best estimated next move.' : 'The plant needs water. Train the agent to learn a route across the grid.'}</p>
    {!trained && <button onClick={run}>Train the garden helper</button>}<Completion complete={busy} completed={completed} retry={onComplete} failed={failed} />
  </div>;
}

export function ActivityPage() {
  const { activityId } = useParams(); const queryClient = useQueryClient();
  const activity = activities.find((item) => item.id === activityId);
  const progress = useQuery({ queryKey: ['activity-progress'], queryFn: () => api('/activities/progress') });
  const completeMutation = useMutation({ mutationFn: () => api(`/activities/${activityId}/completion`, { method: 'POST' }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['activity-progress'] }) });
  if (!activity) return <div className="stack"><h1>Activity not found</h1><Link to="/learn/activities">Back to activities</Link></div>;
  return <div className="stack"><Link to="/learn/activities">← All activities</Link><p className="kicker">{activity.topic}</p><h1>{activity.title}</h1><p>{activity.description}</p>
    <QueryState query={progress}>{() => { const completed = progress.data.items.some((item) => item.activityId === activityId); const onComplete = () => { if (!completed && !completeMutation.isPending) completeMutation.mutate(); };
      const common = { onComplete, busy: completeMutation.isPending, completed, failed: completeMutation.isError };
      if (activityId === 'garden-explorer') return <GardenExplorer {...common} />;
      if (activityId === 'sort-the-garden') return <SortGarden {...common} />;
      if (activityId === 'cleanup-rush') return <CleanupRush {...common} />;
      return <LearningAgent {...common} />;
    }}</QueryState>
  </div>;
}
