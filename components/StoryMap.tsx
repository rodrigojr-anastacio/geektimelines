'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import styles from './StoryMap.module.css';
import { computeLayout, edgePath, NODE_H, NODE_W, type Mode } from '@/lib/layout';
import { centroid, clampView, clampZoom, EDGE_MARGIN, flickVelocity, glideStep, isPinned, pinchZoom, zoomAround } from '@/lib/gesture';
import type { Connection, Entry, Track } from '@/lib/schema';
import { IconBack, IconChevron, IconClose, IconExitFull, IconFit, IconFull, IconMinus, IconPlus } from './icons';

const KIND_LABEL: Record<Connection['kind'], string> = {
  seq: 'Direct continuation',
  setup: 'Setup / post-credits',
  char: 'Shared character',
  branch: 'Multiverse branch',
  inf: 'Announced / inferred',
};
const KIND_STYLE: Record<Connection['kind'], { color: string; dash: string; width: number }> = {
  seq: { color: 'var(--edge-seq)', dash: '', width: 1.5 },
  setup: { color: 'var(--edge-setup)', dash: '6 4', width: 1.4 },
  char: { color: 'var(--edge-char)', dash: '1 4', width: 1.4 },
  branch: { color: 'var(--edge-branch)', dash: '', width: 1.7 },
  inf: { color: 'var(--edge-inf)', dash: '3 5', width: 1.3 },
};
const TYPE_LABEL: Record<Entry['type'], string> = {
  film: 'Film', series: 'Series', special: 'Special', oneshot: 'One-Shot', anim: 'Animation',
};
const CONTEXT_LABEL: Record<'official' | 'reported', string> = {
  official: 'Studio premise — not a summary of the finished work',
  reported: 'Reported production details — unofficial, not a plot summary',
};
const CONFIDENCE: Record<string, { mark: string; note: string }> = {
  approx: { mark: '≈', note: 'In-universe year not officially confirmed. The placement follows the consensus of chronology guides and the title’s own internal references.' },
  tv: { mark: '≈', note: 'A Marvel Television production. It appears in chronology guides, but its canon status inside Marvel Studios’ official timeline is debated.' },
  future: { mark: '⧗', note: 'Announced title with no officially released plot material. Its position is provisional and no summary was written, to avoid inventing content.' },
  pending: { mark: '⧗', note: 'Already released, but this map has no verified summary yet. Nothing was written rather than guessing at the plot.' },
  alt: { mark: '✦', note: 'Not part of the main timeline axis. It sits here only for readability.' },
};

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const formatRelease = (value: string | null) =>
  !value ? 'TBA' : value.length === 4 ? value : `${MONTHS[Number(value.slice(5, 7))]} ${value.slice(0, 4)}`;

export interface StoryMapProps {
  entries: Entry[];
  tracks: Track[];
  connections: Connection[];
  posters: Record<string, string | null>;
}

export default function StoryMap({ entries, tracks, connections, posters }: StoryMapProps) {
  const [mode, setMode] = useState<Mode>('story');
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [phases, setPhases] = useState<Set<number>>(new Set([1, 2, 3, 4, 5, 6]));
  const [kinds, setKinds] = useState<Set<Connection['kind']>>(new Set(['seq', 'setup', 'char', 'branch', 'inf']));
  const [zoom, setZoom] = useState(0.62);
  const [full, setFull] = useState(false);
  const [pinged, setPinged] = useState<string | null>(null);
  const [hintVisible, setHintVisible] = useState(true);
  const [legendOpen, setLegendOpen] = useState(true);

  const frameRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef({ x: 26, y: 34, k: 0.62 });
  const layoutRef = useRef({ width: 0, height: 0 });
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const gestureRef = useRef<
    | { kind: 'pan'; x: number; y: number; vx: number; vy: number }
    | { kind: 'pinch'; distance: number; midX: number; midY: number; k: number; x: number; y: number }
    | null
  >(null);
  const movedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const glideRef = useRef<number | null>(null);
  /** Recent move samples, used to carry a flick into a short glide. */
  const flickRef = useRef<{ t: number; x: number; y: number }[]>([]);

  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);
  const layout = useMemo(() => computeLayout(entries, tracks, mode), [entries, tracks, mode]);
  layoutRef.current = { width: layout.width, height: layout.height };

  const neighbours = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const entry of entries) map.set(entry.id, new Set([entry.id]));
    for (const link of connections) {
      map.get(link.from)?.add(link.to);
      map.get(link.to)?.add(link.from);
    }
    return map;
  }, [entries, connections]);

  /** Writes the view out, but never past the edges of the canvas. */
  const markMoving = useCallback((moving: boolean) => {
    worldRef.current?.classList.toggle(styles.moving, moving);
  }, []);

  const applyView = useCallback(() => {
    const box = stageRef.current?.getBoundingClientRect();
    if (box && box.width > 0 && layoutRef.current.width > 0) {
      viewRef.current = clampView(viewRef.current, layoutRef.current, box);
    }
    const { x, y, k } = viewRef.current;
    if (worldRef.current) worldRef.current.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
    setZoom(k);
  }, []);

  const animateTo = useCallback((k: number, x: number, y: number, ms = 520) => {
    const start = { ...viewRef.current };
    const t0 = performance.now();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (glideRef.current) { cancelAnimationFrame(glideRef.current); glideRef.current = null; }
    markMoving(true);
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      viewRef.current = {
        k: start.k + (k - start.k) * e,
        x: start.x + (x - start.x) * e,
        y: start.y + (y - start.y) * e,
      };
      applyView();
      if (p < 1) rafRef.current = requestAnimationFrame(step);
      else markMoving(false);
    };
    rafRef.current = requestAnimationFrame(step);
  }, [applyView, markMoving]);

  const frameBox = () => stageRef.current?.getBoundingClientRect() ?? new DOMRect(0, 0, 1000, 700);

  const fit = useCallback(() => {
    const box = frameBox();
    if (box.width < 40 || box.height < 40) return;
    const raw = Math.min((box.width - 60) / layout.width, (box.height - 170) / layout.height);
    const k = clampZoom(raw);
    // When the map cannot actually fit — a phone hits the minimum zoom — centring
    // would drop you in the middle of the timeline. Anchor to the start instead.
    const x = raw < k ? EDGE_MARGIN : (box.width - layout.width * k) / 2;
    animateTo(k, x, 100 + (box.height - 170 - layout.height * k) / 2);
  }, [animateTo, layout.width, layout.height]);

  const focusNode = useCallback((id: string) => {
    const spot = layout.placed.get(id);
    if (!spot) return;
    const box = frameBox();
    const drawerWidth = box.width > 640 ? 400 : 0;
    const k = Math.max(viewRef.current.k, 0.72);
    animateTo(k, (box.width - drawerWidth) / 2 - (spot.x + NODE_W / 2) * k, box.height / 2 - (spot.y + NODE_H / 2) * k);
    setPinged(id);
    window.setTimeout(() => setPinged((current) => (current === id ? null : current)), 1900);
  }, [animateTo, layout.placed]);

  const open = useCallback((id: string, fromLink = false) => {
    setSelected((current) => {
      if (current && current !== id && fromLink) setHistory((h) => [...h, current]);
      return id;
    });
    setHintVisible(false);
    focusNode(id);
  }, [focusNode]);

  const close = useCallback(() => {
    setSelected(null);
    setHistory([]);
  }, []);

  const goBack = useCallback(() => {
    setHistory((h) => {
      if (!h.length) return h;
      const previous = h[h.length - 1];
      setSelected(previous);
      focusNode(previous);
      return h.slice(0, -1);
    });
  }, [focusNode]);

  /* ---- pan & zoom ---- */
  useEffect(() => { applyView(); }, [applyView]);

  /* On a narrow screen the default framing lands on empty canvas, so fit once the
     stage actually has a size. The first paint can report a zero-width box and an
     emulated viewport resizes after mount, so poll a few frames instead of trusting
     a single measurement. */
  const didFrame = useRef(false);
  useEffect(() => {
    let attempts = 0;
    let timer = 0;
    const tryFrame = () => {
      if (didFrame.current) return;
      const width = stageRef.current?.getBoundingClientRect().width ?? 0;
      if (width > 40) {
        didFrame.current = true;
        if (width < 760) fit();
        return;
      }
      if (attempts++ < 20) timer = window.setTimeout(tryFrame, 60);
    };
    timer = window.setTimeout(tryFrame, 0);
    return () => window.clearTimeout(timer);
  }, [fit]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let settle = 0;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      markMoving(true);
      window.clearTimeout(settle);
      settle = window.setTimeout(() => markMoving(false), 180);
      const box = stage.getBoundingClientRect();
      const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0016));
      viewRef.current = zoomAround(
        viewRef.current,
        viewRef.current.k * factor,
        event.clientX - box.left,
        event.clientY - box.top,
      );
      applyView();
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      stage.removeEventListener('wheel', onWheel);
      window.clearTimeout(settle);
    };
  }, [applyView, markMoving]);

  const stopGlide = () => {
    if (glideRef.current) cancelAnimationFrame(glideRef.current);
    glideRef.current = null;
  };

  /** Returns true when a glide actually started. */
  const startGlide = useCallback(() => {
    let velocity = flickVelocity(flickRef.current, performance.now());
    if (!velocity) return false;
    const step = () => {
      const next = glideStep(velocity!);
      if (!next) { glideRef.current = null; markMoving(false); return; }
      velocity = next;
      const box = stageRef.current?.getBoundingClientRect();
      const proposed = {
        ...viewRef.current,
        x: viewRef.current.x + next.vx,
        y: viewRef.current.y + next.vy,
      };
      if (box) {
        // Kill the component that is pushing into a wall, so the glide dies at
        // the edge instead of grinding against it.
        const pinned = isPinned(proposed, layoutRef.current, box);
        if (pinned.x) velocity.vx = 0;
        if (pinned.y) velocity.vy = 0;
        if (!velocity.vx && !velocity.vy) { glideRef.current = null; applyView(); markMoving(false); return; }
      }
      viewRef.current = proposed;
      applyView();
      glideRef.current = requestAnimationFrame(step);
    };
    glideRef.current = requestAnimationFrame(step);
    return true;
  }, [applyView, markMoving]);

  useEffect(() => {
    const centreOf = () => centroid([...pointersRef.current.values()]);

    const rebase = () => {
      const stage = stageRef.current;
      if (!stage) return;
      const box = stage.getBoundingClientRect();
      const { midX, midY, distance } = centreOf();
      if (pointersRef.current.size >= 2) {
        gestureRef.current = {
          kind: 'pinch',
          distance,
          midX: midX - box.left,
          midY: midY - box.top,
          k: viewRef.current.k,
          x: viewRef.current.x,
          y: viewRef.current.y,
        };
      } else {
        gestureRef.current = { kind: 'pan', x: midX, y: midY, vx: viewRef.current.x, vy: viewRef.current.y };
      }
    };

    const onMove = (event: PointerEvent) => {
      if (!pointersRef.current.has(event.pointerId)) return;
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const gesture = gestureRef.current;
      if (!gesture || !stageRef.current) return;

      if (gesture.kind === 'pinch') {
        movedRef.current = true;
        const { distance } = centreOf();
        const next = pinchZoom(gesture.k, gesture.distance, distance);
        viewRef.current = zoomAround({ k: gesture.k, x: gesture.x, y: gesture.y }, next, gesture.midX, gesture.midY);
        applyView();
        return;
      }

      const { midX, midY } = centreOf();
      if (Math.abs(midX - gesture.x) + Math.abs(midY - gesture.y) > 4) movedRef.current = true;
      if (!movedRef.current) return;
      const x = gesture.vx + (midX - gesture.x);
      const y = gesture.vy + (midY - gesture.y);
      flickRef.current.push({ t: performance.now(), x, y });
      if (flickRef.current.length > 5) flickRef.current.shift();
      viewRef.current = { ...viewRef.current, x, y };
      applyView();
    };

    const onUp = (event: PointerEvent) => {
      if (!pointersRef.current.delete(event.pointerId)) return;
      if (pointersRef.current.size === 0) {
        const wasPan = gestureRef.current?.kind === 'pan';
        gestureRef.current = null;
        stageRef.current?.classList.remove(styles.grabbing);
        // The layer must be demoted whenever nothing is animating any more,
        // otherwise it keeps a stale raster and the next zoom looks blurry.
        if (!(wasPan && movedRef.current && startGlide())) markMoving(false);
        flickRef.current = [];
      } else {
        // A finger lifted mid-pinch: rebase the gesture on whatever is still down.
        rebase();
        flickRef.current = [];
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [applyView, startGlide]);

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    stopGlide();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    markMoving(true);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size === 1) movedRef.current = false;
    flickRef.current = [];
    const stage = stageRef.current;
    if (!stage) return;
    const box = stage.getBoundingClientRect();
    const points = [...pointersRef.current.values()];
    const { midX, midY, distance } = centroid(points);
    if (points.length >= 2) {
      gestureRef.current = {
        kind: 'pinch',
        distance,
        midX: midX - box.left,
        midY: midY - box.top,
        k: viewRef.current.k,
        x: viewRef.current.x,
        y: viewRef.current.y,
      };
    } else {
      gestureRef.current = { kind: 'pan', x: midX, y: midY, vx: viewRef.current.x, vy: viewRef.current.y };
      stage.classList.add(styles.grabbing);
    }
  };

  const onStageClick = (event: React.MouseEvent) => {
    if (movedRef.current) return;
    if (!(event.target as HTMLElement).closest(`.${styles.node}`)) close();
  };

  /* ---- fullscreen (native, with a fixed-overlay fallback for embeds) ---- */
  const toggleFull = useCallback(() => {
    const frame = frameRef.current;
    if (!frame) return;
    if (document.fullscreenElement) { void document.exitFullscreen(); return; }
    if (full) { setFull(false); return; }
    try { void frame.requestFullscreen?.().catch(() => {}); } catch { /* embeds reject silently */ }
    window.setTimeout(() => { if (!document.fullscreenElement) setFull(true); }, 240);
  }, [full]);

  useEffect(() => {
    const onChange = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    document.body.style.overflow = full && !document.fullscreenElement ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [full]);

  /* ---- keyboard ---- */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        if (event.key === 'Escape') target.blur();
        return;
      }
      if (event.key === 'Escape') {
        if (full && !document.fullscreenElement) { setFull(false); return; }
        close();
      }
      const box = frameBox();
      const zoomBy = (factor: number) => {
        viewRef.current = zoomAround(viewRef.current, viewRef.current.k * factor, box.width / 2, box.height / 2);
        applyView();
      };
      if (event.key === '+' || event.key === '=') zoomBy(1.2);
      if (event.key === '-') zoomBy(0.83);
      if (event.key === '0') fit();
      if (event.key === 'f' || event.key === 'F') toggleFull();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [applyView, close, fit, full, toggleFull]);

  useEffect(() => {
    const onResize = () => applyView();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [applyView]);

  useEffect(() => {
    const timer = window.setTimeout(() => setHintVisible(false), 7000);
    return () => window.clearTimeout(timer);
  }, []);

  /* ---- derived view state ---- */
  const focus = selected ?? hovered;
  const near = focus ? neighbours.get(focus) : null;
  const normalizedQuery = query.trim().toLowerCase();

  const isDimmed = (entry: Entry) =>
    !phases.has(entry.phase) ||
    (normalizedQuery.length > 0 && !entry.title.toLowerCase().includes(normalizedQuery)) ||
    (near ? !near.has(entry.id) : false);

  const selectedEntry = selected ? byId.get(selected) : null;
  const outbound = selected ? connections.filter((c) => c.from === selected) : [];
  const inbound = selected ? connections.filter((c) => c.to === selected) : [];

  const zoomBtn = (factor: number) => () => {
    const box = frameBox();
    viewRef.current = zoomAround(viewRef.current, viewRef.current.k * factor, box.width / 2, box.height / 2);
    applyView();
  };

  const renderLink = (link: Connection, direction: 'out' | 'in') => {
    const otherId = direction === 'out' ? link.to : link.from;
    const other = byId.get(otherId);
    if (!other) return null;
    return (
      <button
        key={`${direction}-${link.from}-${link.to}`}
        className={styles.link}
        onClick={() => open(otherId, true)}
      >
        <span className={styles.linkBar} style={{ background: KIND_STYLE[link.kind].color }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className={styles.linkKind}>
            {direction === 'out' ? 'Leads to' : 'Comes from'} · {KIND_LABEL[link.kind]}
          </span>
          <span className={styles.linkTitle} style={{ display: 'block' }}>{other.title}</span>
          <span className={styles.linkNote} style={{ display: 'block' }}>{link.note}</span>
        </span>
        <span className={styles.linkChevron}><IconChevron /></span>
      </button>
    );
  };

  return (
    <div className={styles.shell}>
      {/* AdSense slot — left rail, reserved space only */}
      <aside className={`${styles.rail} ${styles.railLeft}`}>
        <div className="ad-slot ad-rail" data-ad-slot="rail-left" />
      </aside>

      <div ref={frameRef} className={`${styles.frame} ${full ? 'isFull' : ''}`}>
        <div
          ref={stageRef}
          className={styles.stage}
          onPointerDown={onPointerDown}
          onClick={onStageClick}
        >
          <div ref={worldRef} className={styles.world} style={{ width: layout.width, height: layout.height }}>
            <svg className={styles.edges} width={layout.width} height={layout.height} aria-hidden="true">
              {connections.map((link) => {
                const from = layout.placed.get(link.from);
                const to = layout.placed.get(link.to);
                if (!from || !to) return null;
                const style = KIND_STYLE[link.kind];
                const live = kinds.has(link.kind)
                  && phases.has(byId.get(link.from)!.phase)
                  && phases.has(byId.get(link.to)!.phase);
                const inFocus = !focus || link.from === focus || link.to === focus;
                const opacity = !live ? 0 : inFocus ? (focus ? 0.95 : 0.42) : 0.05;
                return (
                  <path
                    key={`${link.from}-${link.to}-${link.kind}`}
                    d={edgePath(from, to)}
                    stroke={style.color}
                    strokeWidth={focus && inFocus ? style.width + 0.9 : style.width}
                    strokeDasharray={style.dash || undefined}
                    opacity={opacity}
                  >
                    <title>{`${byId.get(link.from)?.title} → ${byId.get(link.to)?.title} · ${link.note}`}</title>
                  </path>
                );
              })}
            </svg>

            {layout.bands.map((band) => (
              <div key={band.id}>
                <div className={styles.band} style={{ top: band.top, height: band.height, width: layout.width - 60 }} />
                <div className={styles.bandLabel} style={{ top: band.top, height: band.height }}>{band.name}</div>
              </div>
            ))}

            {layout.columns.map((column) => (
              <div key={column.key}>
                <div className={styles.gridLine} style={{ left: column.x, height: layout.height }} />
                <div className={styles.yearTag} style={{ left: column.x, top: 78 }}>
                  {column.label}
                  <b>{column.sublabel}</b>
                </div>
              </div>
            ))}

            {entries.map((entry) => {
              const spot = layout.placed.get(entry.id);
              if (!spot) return null;
              const poster = posters[entry.id];
              const confidence = CONFIDENCE[entry.confidence];
              const matched = normalizedQuery.length > 0 && entry.title.toLowerCase().includes(normalizedQuery);
              return (
                <div
                  key={entry.id}
                  className={`${styles.nodeWrap} ${isDimmed(entry) ? styles.dimmed : ''}`}
                  style={{ transform: `translate(${spot.x}px, ${spot.y}px)` }}
                >
                  <button
                    type="button"
                    className={[
                      styles.node,
                      selected === entry.id ? styles.selected : '',
                      matched ? styles.hit : '',
                      pinged === entry.id ? styles.ping : '',
                    ].join(' ')}
                    onClick={(event) => { event.stopPropagation(); open(entry.id); }}
                    onMouseEnter={() => setHovered(entry.id)}
                    onMouseLeave={() => setHovered(null)}
                    aria-label={`${entry.title} — open details`}
                  >
                    {poster ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className={styles.poster} src={poster} alt="" loading="lazy" width={46} height={69} />
                    ) : (
                      <span className={styles.posterFallback} aria-hidden="true">{entry.title.charAt(0)}</span>
                    )}
                    <span className={styles.nodeBody}>
                      <span className={styles.nodeMeta}>Phase {entry.phase} · {TYPE_LABEL[entry.type]}</span>
                      <span className={styles.nodeTitle} style={{ display: 'block' }}>{entry.title}</span>
                      <span className={styles.nodeYear}>
                        {mode === 'release' ? formatRelease(entry.releaseDate) : entry.inUniverseLabel}
                      </span>
                    </span>
                    {confidence && <span className={styles.mark} title={confidence.note}>{confidence.mark}</span>}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className={`${styles.hud} ${styles.toolbar}`}>
          <div className={styles.segmented}>
            {(['story', 'release'] as Mode[]).map((value) => (
              <button
                key={value}
                data-on={mode === value}
                onClick={() => { setMode(value); if (selected) window.setTimeout(() => focusNode(selected), 120); }}
              >
                {value === 'story' ? 'In-universe' : 'Release'}
              </button>
            ))}
          </div>
          <div className={styles.phaseBar}>
            {[1, 2, 3, 4, 5, 6].map((phase) => (
              <button
                key={phase}
                data-on={phases.has(phase)}
                title={`Toggle phase ${phase}`}
                aria-label={`Toggle phase ${phase}`}
                onClick={() =>
                  setPhases((current) => {
                    const next = new Set(current);
                    if (next.has(phase)) next.delete(phase); else next.add(phase);
                    return next;
                  })
                }
              >
                P{phase}
              </button>
            ))}
          </div>
          <input
            className={styles.mapSearch}
            placeholder="Search a title…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search a title"
          />
        </div>

        <div className={`${styles.hud} ${styles.legend}`} data-collapsed={legendOpen ? 'false' : 'true'}>
          <button
            className={styles.legendHead}
            onClick={() => setLegendOpen((open) => !open)}
            aria-expanded={legendOpen}
          >
            <h4>Connections</h4>
            <span className={styles.legendToggle}>{legendOpen ? '−' : '+'}</span>
          </button>
          {legendOpen && <div className={styles.legendBody}>
          {(Object.keys(KIND_LABEL) as Connection['kind'][]).map((kind) => (
            <button
              key={kind}
              className={styles.legendRow}
              data-off={!kinds.has(kind)}
              onClick={() =>
                setKinds((current) => {
                  const next = new Set(current);
                  if (next.has(kind)) next.delete(kind); else next.add(kind);
                  return next;
                })
              }
            >
              <svg width="26" height="6" aria-hidden="true">
                <line
                  x1="0" y1="3" x2="26" y2="3"
                  stroke={KIND_STYLE[kind].color}
                  strokeWidth={KIND_STYLE[kind].width + 0.5}
                  strokeDasharray={KIND_STYLE[kind].dash || undefined}
                />
              </svg>
              {KIND_LABEL[kind]}
            </button>
          ))}
          </div>}
        </div>

        <div className={`${styles.hud} ${styles.zoombox}`}>
          <button className={styles.iconBtn} onClick={zoomBtn(0.8)} aria-label="Zoom out"><IconMinus /></button>
          <span className={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
          <button className={styles.iconBtn} onClick={zoomBtn(1.25)} aria-label="Zoom in"><IconPlus /></button>
          <span className={styles.divider} />
          <button className={styles.iconBtn} onClick={fit} aria-label="Fit map to screen" title="Fit to screen"><IconFit /></button>
          <button className={styles.iconBtn} onClick={toggleFull} aria-label="Toggle fullscreen" title="Fullscreen (F)">
            {full || (typeof document !== 'undefined' && document.fullscreenElement) ? <IconExitFull /> : <IconFull />}
          </button>
        </div>

        {hintVisible && <div className={`${styles.hint} ${styles.hintDesktop}`}>drag to pan · scroll to zoom · click a card</div>}

        <aside className={styles.drawer} data-open={!!selectedEntry} aria-hidden={!selectedEntry}>
          {selectedEntry && (
            <>
              <div className={styles.drawerHead}>
                {history.length > 0 && (
                  <button className={styles.iconBtn} onClick={goBack} aria-label="Back"><IconBack /></button>
                )}
                <span className="mono">Entry</span>
                <button className={styles.iconBtn} onClick={close} aria-label="Close"><IconClose /></button>
              </div>
              <div className={styles.drawerBody}>
                {posters[selectedEntry.id] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className={styles.drawerPoster} src={posters[selectedEntry.id]!} alt="" width={92} height={138} />
                )}
                <span className="mono">Phase {selectedEntry.phase} · {TYPE_LABEL[selectedEntry.type]}</span>
                <h2 className={styles.drawerTitle}>{selectedEntry.title}</h2>
                <div className={styles.pillRow}>
                  <span className={styles.pill}>{selectedEntry.inUniverseLabel}</span>
                  <span className={styles.pill}>Released {formatRelease(selectedEntry.releaseDate)}</span>
                </div>
                {selectedEntry.summary ? (
                  <p className={styles.summary}>{selectedEntry.summary}</p>
                ) : selectedEntry.context && selectedEntry.contextSource ? (
                  <div className={styles.context}>
                    <span className={styles.contextLabel}>{CONTEXT_LABEL[selectedEntry.contextSource]}</span>
                    <p className={styles.summary}>{selectedEntry.context}</p>
                  </div>
                ) : (
                  <p className={styles.summary} style={{ color: 'var(--ink-45)' }}>
                    No verified summary yet. Nothing was written here so the map does not invent a story.
                  </p>
                )}
                {CONFIDENCE[selectedEntry.confidence] && (
                  <p className={styles.caveat}>
                    <b>{CONFIDENCE[selectedEntry.confidence].mark}</b> {CONFIDENCE[selectedEntry.confidence].note}
                  </p>
                )}
                {outbound.length > 0 && (
                  <>
                    <div className={styles.sectionLabel}>Leads to ({outbound.length})</div>
                    {outbound.map((link) => renderLink(link, 'out'))}
                  </>
                )}
                {inbound.length > 0 && (
                  <>
                    <div className={styles.sectionLabel}>Comes from ({inbound.length})</div>
                    {inbound.map((link) => renderLink(link, 'in'))}
                  </>
                )}
                {outbound.length === 0 && inbound.length === 0 && (
                  <>
                    <div className={styles.sectionLabel}>Connections</div>
                    <p className={styles.linkNote}>No mapped connections yet.</p>
                  </>
                )}
                <Link className={styles.fullPageLink} href={`/mcu/${selectedEntry.slug}`}>
                  Open the full entry →
                </Link>
                {/* AdSense slot — in-article, reserved space only */}
                <div className="ad-slot ad-inline" data-ad-slot="drawer-inline" />
              </div>
            </>
          )}
        </aside>
      </div>

      {/* AdSense slot — right rail, reserved space only */}
      <aside className={`${styles.rail} ${styles.railRight}`}>
        <div className="ad-slot ad-rail" data-ad-slot="rail-right" />
      </aside>
    </div>
  );
}
