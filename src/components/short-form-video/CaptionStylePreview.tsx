'use client';

import { useEffect, useMemo, useState } from 'react';

export type CaptionAnimationPreset = 'none' | 'stable-pop' | 'fluid-pop' | 'pulse' | 'glow';

export interface CaptionStylePreviewValue {
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  wordSpacing: number;
  horizontalPadding: number;
  bottomMargin: number;
  activeWordColor: string;
  spokenWordColor: string;
  upcomingWordColor: string;
  outlineColor: string;
  outlineWidth: number;
  shadowColor: string;
  shadowStrength: number;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  backgroundEnabled: boolean;
  backgroundColor: string;
  backgroundOpacity: number;
  backgroundPadding: number;
  backgroundRadius: number;
  animationPreset: CaptionAnimationPreset;
}

const SAMPLE_LINES = [
  ['Lift', 'your', 'tongue', 'lightly'],
  ['and', 'keep', 'your', 'neck', 'long'],
] as const;
const SAMPLE_WORDS = SAMPLE_LINES.flat();
const WORD_SWITCH_MS = 650;
const FONT_WEIGHT_SUFFIX_RE = /\s+(thin|hairline|extra\s*light|ultra\s*light|light|book|regular|normal|medium|semi\s*bold|semibold|demi\s*bold|bold|extra\s*bold|ultra\s*bold|black|heavy)\s*$/i;

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return '255,255,255';
  const bigint = parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `${r}, ${g}, ${b}`;
}

function sanitizePreviewFontFamily(fontFamily: string) {
  let family = String(fontFamily || '').trim().replace(/\s+/g, ' ');
  while (FONT_WEIGHT_SUFFIX_RE.test(family)) {
    family = family.replace(FONT_WEIGHT_SUFFIX_RE, '').trim();
  }
  return family || 'Arial';
}

function buildOutlineShadow(style: CaptionStylePreviewValue) {
  const outlineColor = `rgba(${hexToRgb(style.outlineColor)}, 0.94)`;
  const shadowColor = `rgba(${hexToRgb(style.shadowColor)}, ${Math.min(1, 0.16 + style.shadowStrength * 0.1)})`;
  const outline = Math.max(0, style.outlineWidth);
  const shadowBlur = Math.max(0, style.shadowBlur);
  const shadowOffsetX = style.shadowOffsetX;
  const shadowOffsetY = style.shadowOffsetY;
  const pieces = outline > 0
    ? [
        `${outline}px 0 0 ${outlineColor}`,
        `-${outline}px 0 0 ${outlineColor}`,
        `0 ${outline}px 0 ${outlineColor}`,
        `0 -${outline}px 0 ${outlineColor}`,
      ]
    : [];
  if (style.shadowStrength > 0) {
    pieces.push(`${shadowOffsetX}px ${shadowOffsetY}px ${Math.max(0, shadowBlur * 4)}px ${shadowColor}`);
  }
  return pieces.join(', ');
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(value: number) {
  const t = clamp01(value);
  return 1 - ((1 - t) ** 3);
}

function resolvePreviewPhase(animationPreset: CaptionAnimationPreset, wordProgress: number) {
  if (animationPreset === 'none') return 1;
  if (animationPreset === 'stable-pop' || animationPreset === 'fluid-pop') return Math.min(1, wordProgress / 0.42);
  return wordProgress;
}

function resolvePopTransform(phase: number) {
  const t = clamp01(phase);
  const popInPortion = 0.16;
  if (t <= popInPortion) {
    const grow = easeOutCubic(t / popInPortion);
    return {
      scale: 1 + ((1.18 - 1) * grow),
      liftEm: 0.11 * grow,
    };
  }
  const settle = easeOutCubic((t - popInPortion) / (1 - popInPortion));
  return {
    scale: 1.18 + ((1 - 1.18) * settle),
    liftEm: 0.11 + ((0 - 0.11) * settle),
  };
}

function resolveActiveWordMotion(animationPreset: CaptionAnimationPreset, phase: number) {
  if (animationPreset === 'none') return { scale: 1, liftEm: 0 };
  if (animationPreset === 'stable-pop' || animationPreset === 'fluid-pop') {
    return resolvePopTransform(phase);
  }
  if (animationPreset === 'pulse') {
    return {
      scale: 1.03 + Math.sin(phase * Math.PI * 2) * 0.05,
      liftEm: 0.03,
    };
  }
  return {
    scale: 1.04 + Math.sin(phase * Math.PI * 2) * 0.02,
    liftEm: 0.015,
  };
}

function measurePreviewAdvance(text: string, fontFamily: string, fontWeight: number, fontSize: number) {
  if (typeof document === 'undefined') {
    const units = text === ' ' ? 0.28 : Math.max(0.55, text.length * 0.34);
    return fontSize * units;
  }
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    const units = text === ' ' ? 0.28 : Math.max(0.55, text.length * 0.34);
    return fontSize * units;
  }
  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  return context.measureText(text).width;
}

export function CaptionStylePreview({
  style,
  animated = true,
  className,
}: {
  style: CaptionStylePreviewValue;
  animated?: boolean;
  className?: string;
}) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!animated) {
      setElapsedMs(0);
      return;
    }
    let frame = 0;
    let startAt = 0;
    const tick = (now: number) => {
      if (!startAt) startAt = now;
      setElapsedMs(now - startAt);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [animated]);

  const activeIndex = animated
    ? Math.floor(elapsedMs / WORD_SWITCH_MS) % SAMPLE_WORDS.length
    : 3;
  const wordProgress = animated
    ? (elapsedMs % WORD_SWITCH_MS) / WORD_SWITCH_MS
    : 0.82;
  const phase = useMemo(
    () => resolvePreviewPhase(style.animationPreset, wordProgress),
    [style.animationPreset, wordProgress],
  );
  const boxBackground = `rgba(${hexToRgb(style.backgroundColor)}, ${style.backgroundOpacity})`;
  const fontSize = Math.max(26, Math.min(52, Math.round(style.fontSize * 0.58)));
  const horizontalInsetPercent = Math.max(0, Math.min(32, (style.horizontalPadding / 1080) * 100));
  const bottomInsetPercent = Math.max(0, Math.min(45, (style.bottomMargin / 1920) * 100));
  const previewFontFamily = sanitizePreviewFontFamily(style.fontFamily);
  const previewGapPx = useMemo(() => {
    const baseSpace = measurePreviewAdvance(' ', previewFontFamily, style.fontWeight, fontSize);
    return Math.max(1, Math.round((baseSpace + style.wordSpacing) * 10) / 10);
  }, [fontSize, previewFontFamily, style.fontWeight, style.wordSpacing]);
  const stableSlotWidths = useMemo(
    () => SAMPLE_LINES.map((line) => line.map((word) => Math.max(fontSize * 0.55, measurePreviewAdvance(word, previewFontFamily, style.fontWeight, fontSize)))),
    [fontSize, previewFontFamily, style.fontWeight],
  );
  const lineMinHeight = Math.ceil(fontSize * 1.38);
  const usesStableWordSlots = style.animationPreset !== 'fluid-pop';

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-slate-800 via-slate-900 to-black p-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_38%),radial-gradient(circle_at_bottom,rgba(59,130,246,0.16),transparent_32%)]" />
        <div className="relative min-h-[260px] rounded-xl px-4 py-6">
          <div
            className="absolute text-center leading-tight"
            style={{
              left: `${horizontalInsetPercent}%`,
              right: `${horizontalInsetPercent}%`,
              bottom: `${bottomInsetPercent}%`,
            }}
          >
            <div
              style={{
                fontFamily: previewFontFamily,
                fontWeight: style.fontWeight,
                fontSize: `${fontSize}px`,
                background: style.backgroundEnabled ? boxBackground : 'transparent',
                padding: style.backgroundEnabled ? `${Math.max(10, style.backgroundPadding * 0.7)}px ${Math.max(14, style.backgroundPadding * 0.9)}px` : 0,
                borderRadius: style.backgroundEnabled ? Math.max(0, style.backgroundRadius) : 0,
              }}
            >
              <div className="flex flex-col items-center gap-2">
                {SAMPLE_LINES.map((line, lineIndex) => {
                  const lineOffset = SAMPLE_LINES.slice(0, lineIndex).reduce((sum, current) => sum + current.length, 0);
                  return (
                    <div
                      key={`line-${lineIndex}`}
                      className="flex items-end justify-center whitespace-nowrap"
                      style={{ gap: `${previewGapPx}px`, minHeight: `${lineMinHeight}px` }}
                    >
                      {line.map((word, wordIndex) => {
                        const globalIndex = lineOffset + wordIndex;
                        const isSpoken = globalIndex < activeIndex;
                        const isActive = globalIndex === activeIndex;
                        const color = isActive
                          ? style.activeWordColor
                          : isSpoken
                            ? style.spokenWordColor
                            : style.upcomingWordColor;
                        const motion = isActive ? resolveActiveWordMotion(style.animationPreset, phase) : { scale: 1, liftEm: 0 };
                        const activeGlow = style.animationPreset === 'glow'
                          ? `0 0 ${Math.max(16, style.shadowBlur * 8)}px rgba(${hexToRgb(style.activeWordColor)}, 0.35)`
                          : undefined;
                        const sharedWordStyle = {
                          color,
                          textShadow: [buildOutlineShadow(style), isActive && activeGlow ? activeGlow : null].filter(Boolean).join(', '),
                          opacity: isActive ? 1 : isSpoken ? 0.96 : 0.92,
                          letterSpacing: style.animationPreset === 'glow' && isActive ? '0.015em' : undefined,
                          willChange: isActive ? 'transform, font-size, text-shadow' : undefined,
                        } as const;

                        if (usesStableWordSlots) {
                          return (
                            <span
                              key={`${word}-${globalIndex}`}
                              className="relative inline-flex items-end justify-center"
                              style={{ width: `${stableSlotWidths[lineIndex][wordIndex]}px`, minHeight: `${lineMinHeight}px` }}
                            >
                              <span aria-hidden className="invisible select-none">{word}</span>
                              <span
                                className="pointer-events-none absolute bottom-0 left-1/2 whitespace-nowrap"
                                style={{
                                  ...sharedWordStyle,
                                  transform: `translateX(-50%) translateY(-${motion.liftEm.toFixed(3)}em) scale(${motion.scale.toFixed(3)})`,
                                  transformOrigin: 'center bottom',
                                }}
                              >
                                {word}
                              </span>
                            </span>
                          );
                        }

                        return (
                          <span
                            key={`${word}-${globalIndex}`}
                            className="inline-flex items-end justify-center whitespace-nowrap"
                            style={{
                              ...sharedWordStyle,
                              minHeight: `${lineMinHeight}px`,
                              fontSize: `${(fontSize * motion.scale).toFixed(2)}px`,
                              lineHeight: 1,
                              transform: `translateY(-${motion.liftEm.toFixed(3)}em)`,
                              transformOrigin: 'center bottom',
                            }}
                          >
                            {word}
                          </span>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: style.activeWordColor }} /> Active</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: style.spokenWordColor }} /> Spoken</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: style.upcomingWordColor }} /> Upcoming</span>
      </div>
    </div>
  );
}
