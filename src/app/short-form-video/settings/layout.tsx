import type { ReactNode } from "react";
import { ShortFormVideoSettingsShell } from "@/components/short-form-video/ShortFormVideoSettingsShell";
import { getShortFormBackgroundVideoSettings } from "@/lib/short-form-background-videos";
import { getShortFormImageStyleSettings } from "@/lib/short-form-image-styles";
import { createPageMetadata } from "@/lib/metadata";
import { getShortFormSoundDesignSettings } from "@/lib/short-form-sound-design-settings";
import { getShortFormVideoRenderSettings } from "@/lib/short-form-video-render-settings";

export const metadata = createPageMetadata(
  "Short-Form Video Settings",
  "Configure prompts, voice, visuals, background videos, and music for the short-form workflow."
);

export default function ShortFormVideoSettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const imageStyles = getShortFormImageStyleSettings();
  const videoRender = getShortFormVideoRenderSettings();
  const backgroundVideos = getShortFormBackgroundVideoSettings();
  const soundDesign = getShortFormSoundDesignSettings();

  return (
    <ShortFormVideoSettingsShell
      initialSummary={{
        voiceCount: videoRender.voices.length,
        soundCount: soundDesign.library.length,
        styleCount: imageStyles.styles.length,
        captionStyleCount: videoRender.captionStyles.length,
        backgroundCount: backgroundVideos.backgrounds.length,
        musicTrackCount: videoRender.musicTracks.length,
      }}
    >
      {children}
    </ShortFormVideoSettingsShell>
  );
}
