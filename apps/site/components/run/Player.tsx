"use client";

import { useImperativeHandle, useRef, useState, type Ref } from "react";
import type { ViewportReport } from "@/lib/types";
import { capital } from "@/lib/format";
import styles from "./run.module.css";

export interface PlayerHandle {
  seek: (viewport: ViewportReport["viewport"], offsetMs: number | null) => void;
}

const SPEEDS = [1, 1.5, 2] as const;

interface PlayerProps {
  viewports: ViewportReport[];
  compact?: boolean;
  label?: string;
  ref?: Ref<PlayerHandle>;
}

export function Player({ viewports, compact = false, label, ref }: PlayerProps) {
  const initial = viewports.find((v) => v.verdict !== "PASS") ?? viewports[0];
  const [active, setActive] = useState(initial?.viewport ?? "mobile");
  const [speed, setSpeed] = useState<number>(1);
  const [still, setStill] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pendingSeek = useRef<number | null>(null);
  const positions = useRef(new Map<string, number>());

  const current = viewports.find((v) => v.viewport === active) ?? viewports[0];

  function remember() {
    const v = videoRef.current;
    if (v) positions.current.set(active, v.currentTime);
  }

  function switchTo(next: ViewportReport["viewport"]) {
    if (next === active) return;
    remember();
    setStill(null);
    setFailed(false);
    setActive(next);
  }

  useImperativeHandle(ref, () => ({
    seek(viewport, offsetMs) {
      const target = offsetMs == null ? null : offsetMs / 1000;
      if (viewport !== active || still) {
        pendingSeek.current = target;
        if (viewport !== active) switchTo(viewport);
        setStill(null);
        return;
      }
      const v = videoRef.current;
      if (v && target != null) {
        v.currentTime = Math.min(target, Math.max((v.duration || 0) - 0.1, 0));
        v.focus({ preventScroll: true });
      }
    },
  }));

  function onLoaded(event: React.SyntheticEvent<HTMLVideoElement>) {
    const v = event.currentTarget;
    v.playbackRate = speed;
    const target = pendingSeek.current ?? positions.current.get(active);
    pendingSeek.current = null;
    if (target != null) v.currentTime = Math.min(target, Math.max((v.duration || 0) - 0.1, 0));
  }

  function changeSpeed(rate: number) {
    setSpeed(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
  }

  if (!current) return null;
  const rec = current.recording;
  const shots = current.artifacts.filter((a) => a.kind === "screenshot");
  const stillShot = shots.find((s) => s.id === still);

  return (
    <section className={styles.player} aria-label={label ?? "Recording"}>
      <div className={styles.playerBar}>
        <div className={styles.segmented} role="group" aria-label="Viewport">
          {viewports.map((v) => (
            <button key={v.viewport} type="button" aria-pressed={v.viewport === active} onClick={() => switchTo(v.viewport)}>
              {capital(v.viewport)}
              <span className={styles.segMeta}>{v.verdict === "PASS" ? "pass" : v.verdict === "FAIL" ? "fail" : "unclear"}</span>
            </button>
          ))}
        </div>
        {!compact && (
          <div className={styles.speeds} role="group" aria-label="Playback speed">
            {SPEEDS.map((rate) => (
              <button key={rate} type="button" aria-pressed={speed === rate} onClick={() => changeSpeed(rate)}>
                {rate}×
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={`${styles.stage} ${compact ? styles.stageCompact : ""}`}>
        {stillShot ? (
          <img src={stillShot.url} alt={stillShot.label} />
        ) : rec && !failed ? (
          <video
            key={`${current.viewport}-${rec.url}`}
            ref={videoRef}
            src={rec.url}
            poster={rec.poster_url ?? undefined}
            controls
            muted
            playsInline
            preload="metadata"
            aria-label={`${current.viewport} recording, attempt ${rec.attempt} of ${current.attempts}`}
            onLoadedMetadata={onLoaded}
            onTimeUpdate={(e) => positions.current.set(active, e.currentTarget.currentTime)}
            onError={() => setFailed(true)}
          />
        ) : (
          <p className={styles.stageEmpty}>
            {failed ? "This recording couldn't be played. Evidence links expire after 30 minutes, so reload the page for fresh ones." : "No recording was stored for this viewport. The screenshots below are the evidence."}
          </p>
        )}
        <span className={styles.stageLabel}>
          {stillShot ? stillShot.label.replace(`${current.viewport} `, "Screenshot ") : `${capital(current.viewport)} ${current.size.width} × ${current.size.height}`}
        </span>
        {stillShot && (
          <button type="button" className={styles.backToVideo} onClick={() => setStill(null)}>
            Back to recording
          </button>
        )}
      </div>

      <p className={styles.caption}>
        {rec ? `Attempt ${rec.attempt} of ${current.attempts}, recorded in real time.` : ""}
      </p>

      {!compact && shots.length > 0 && (
        <div className={styles.shots} role="group" aria-label="Screenshots">
          {shots.map((s) => (
            <button key={s.id} type="button" aria-pressed={still === s.id} onClick={() => setStill(s.id)}>
              <img src={s.url} alt="" loading="lazy" />
              <span>{s.label.replace(`${current.viewport} `, "").replace(/-/g, " ")}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
