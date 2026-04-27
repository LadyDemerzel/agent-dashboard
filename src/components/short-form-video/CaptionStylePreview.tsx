'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  getCaptionAnimationPreviewMetadata,
  resolveCaptionAnimationColor,
  resolveCaptionAnimationFrame,
  type ShortFormCaptionAnimationPresetEntry,
} from '@/lib/short-form-caption-animation';

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
  animationPresetId: string;
  animationPreset: ShortFormCaptionAnimationPresetEntry;
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

function buildTextShadows({
  style,
  active,
  activeOutlineColor,
  activeGlowColor,
  shadowColor,
  extraOutlineWidth,
  extraBlur,
  shadowOpacityMultiplier,
  glowStrength,
}: {
  style: CaptionStylePreviewValue;
  active: boolean;
  activeOutlineColor: string;
  activeGlowColor: string;
  shadowColor: string;
  extraOutlineWidth: number;
  extraBlur: number;
  shadowOpacityMultiplier: number;
  glowStrength: number;
}) {
  const outlineColor = `rgba(${hexToRgb(active ? activeOutlineColor : style.outlineColor)}, 0.94)`;
  const shadowAlpha = Math.min(1, (0.16 + style.shadowStrength * 0.1) * Math.max(0, shadowOpacityMultiplier));
  const shadow = `rgba(${hexToRgb(active ? shadowColor : style.shadowColor)}, ${shadowAlpha})`;
  const outline = Math.max(0, style.outlineWidth + (active ? extraOutlineWidth : 0));
  const shadowBlur = Math.max(0, (style.shadowBlur * 4) + (active ? extraBlur * 4 : 0));
  const pieces = outline > 0
    ? [
        `${outline}px 0 0 ${outlineColor}`,
        `-${outline}px 0 0 ${outlineColor}`,
        `0 ${outline}px 0 ${outlineColor}`,
        `0 -${outline}px 0 ${outlineColor}`,
      ]
    : [];
  if (style.shadowStrength > 0) {
    pieces.push(`${style.shadowOffsetX}px ${style.shadowOffsetY}px ${shadowBlur}px ${shadow}`);
  }
  if (active && glowStrength > 0.001) {
    pieces.push(`0 0 ${Math.max(12, 26 * glowStrength)}px rgba(${hexToRgb(activeGlowColor)}, ${Math.min(0.92, 0.2 + glowStrength * 0.5)})`);
  }
  return pieces.join(', ');
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

  const previewElapsedMs = animated ? elapsedMs : 0;
  const activeIndex = animated ? Math.floor(previewElapsedMs / WORD_SWITCH_MS) % SAMPLE_WORDS.length : 3;
  const wordProgress = animated ? (previewElapsedMs % WORD_SWITCH_MS) / WORD_SWITCH_MS : 0.82;
  const animationFrame = useMemo(
    () => resolveCaptionAnimationFrame(style.animationPreset.config, wordProgress, WORD_SWITCH_MS / 1000),
    [style.animationPreset, wordProgress],
  );
  const animationMetadata = useMemo(
    () => getCaptionAnimationPreviewMetadata(style.animationPreset),
    [style.animationPreset],
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
    () => SAMPLE_LINES.map((line) => line.map((word) => Math.max(fontSize * 0.55, measurePreviewAdvance(word, previewFontFamily, style.fontWeight, fontSize) * animationMetadata.peakScale))),
    [animationMetadata.peakScale, fontSize, previewFontFamily, style.fontWeight],
  );
  const lineMinHeight = Math.ceil(fontSize * Math.max(1.38, animationMetadata.peakScale * 1.32));
  const usesStableWordSlots = animationMetadata.usesStableWordSlots;

  const palette = {
    activeWordColor: style.activeWordColor,
    outlineColor: style.outlineColor,
    shadowColor: style.shadowColor,
  };
  const activeOutlineColor = resolveCaptionAnimationColor(
    style.animationPreset.config.colors.outlineColorMode,
    palette,
    style.animationPreset.config.colors.outlineColor,
  );
  const activeShadowColor = resolveCaptionAnimationColor(
    style.animationPreset.config.colors.shadowColorMode,
    palette,
    style.animationPreset.config.colors.shadowColor,
  );
  const activeGlowColor = resolveCaptionAnimationColor(
    style.animationPreset.config.colors.glowColorMode,
    palette,
    style.animationPreset.config.colors.glowColor,
  );

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
                        const color = isActive ? style.activeWordColor : isSpoken ? style.spokenWordColor : style.upcomingWordColor;
                        const wordStyle = {
                          color,
                          textShadow: buildTextShadows({
                            style,
                            active: isActive,
                            activeOutlineColor,
                            activeGlowColor,
                            shadowColor: activeShadowColor,
                            extraOutlineWidth: isActive ? animationFrame.extraOutlineWidth : 0,
                            extraBlur: isActive ? animationFrame.extraBlur : 0,
                            shadowOpacityMultiplier: isActive ? animationFrame.shadowOpacityMultiplier : 1,
                            glowStrength: isActive ? animationFrame.glowStrength : 0,
                          }),
                          opacity: isActive ? 1 : isSpoken ? 0.96 : 0.92,
                          willChange: isActive ? 'transform, text-shadow' : undefined,
                          transform: isActive
                            ? `translate(${animationFrame.translateXEm}em, ${-animationFrame.translateYEm}em) scale(${animationFrame.scale})`
                            : 'translate(0, 0) scale(1)',
                          transformOrigin: '50% 100%',
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
                                style={{ ...wordStyle, transform: `translate(-50%, 0) ${wordStyle.transform}` }}
                              >
                                {word}
                              </span>
                            </span>
                          );
                        }

                        return (
                          <span key={`${word}-${globalIndex}`} className="inline-flex items-end justify-center whitespace-nowrap" style={wordStyle}>
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
    </div>
  );
}
