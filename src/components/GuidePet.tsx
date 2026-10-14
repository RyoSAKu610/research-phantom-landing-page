import { cn } from "../utils/cn";
import type { GuideId } from "../lib/guides";
import { reactionBeat, reactionForScene } from "../character/reactions";

type GuidePetProps = {
  image: string;
  alt: string;
  scene: number;
  playing: boolean;
  beat?: number;
  guide?: GuideId;
  waiting?: boolean;
  preview?: boolean;
  className?: string;
};

/** Illustrated portrait puppet; gestures follow scenes and beats, not phonemes. */
export default function GuidePet({ image, alt, scene, playing, beat = 0, guide, waiting = false, preview = false, className }: GuidePetProps) {
  const sceneNumber = Number.isFinite(scene) ? Math.max(1, Math.min(7, Math.floor(scene) + 1)) : 1;
  const reaction = reactionForScene(sceneNumber);
  const active = playing && !waiting;
  return (
    <div key={`${guide ?? "guide"}-${sceneNumber}`} className={cn("guide-pet", className)}
      data-guide={guide} data-scene={sceneNumber} data-reaction={reaction.name}
      data-playing={active} data-beat={active ? reactionBeat(beat) : 0}
      data-waiting={waiting} data-reaction-source={preview ? "preview" : "voice"}
      title={`肖像の反応：${reaction.label}`}>
      <div className="guide-pet-actor">
        <img src={image} alt={alt} className="guide-pet-portrait" />
        <span className="guide-pet-glaze" aria-hidden="true" />
      </div>
      <span className="guide-pet-symbol" aria-hidden="true" />
      <span className="guide-pet-spark guide-pet-spark-a" aria-hidden="true" />
      <span className="guide-pet-spark guide-pet-spark-b" aria-hidden="true" />
    </div>
  );
}
