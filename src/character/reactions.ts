/** Public scene numbers are 1–7, including in the non-React theater. */
export const REACTIONS = [
  { name: "question", label: "問いかけ", beats: ["首をかしげる", "問いを掲げる", "答えを待つ"] },
  { name: "receive", label: "受け取り", beats: ["資料を迎える", "手元に集める", "受け止める"] },
  { name: "think", label: "思考", beats: ["考えを探る", "手がかりを結ぶ", "ひらめく"] },
  { name: "warn", label: "注意", beats: ["一歩引く", "注意を示す", "立ち止まる"] },
  { name: "observe", label: "観測", beats: ["見渡す", "照準を合わせる", "細部を確かめる"] },
  { name: "organize", label: "整理", beats: ["資料を広げる", "順に並べる", "ひとつに束ねる"] },
  { name: "conclude", label: "結論", beats: ["顔を上げる", "結論を掲げる", "一礼する"] },
] as const;

export function reactionForScene(scene: number) {
  const index = Number.isFinite(scene) ? Math.max(0, Math.min(6, Math.floor(scene) - 1)) : 0;
  return REACTIONS[index];
}

export function reactionBeat(beat: number): 0 | 1 | 2 {
  return (Number.isFinite(beat) ? Math.max(0, Math.min(2, Math.floor(beat))) : 0) as 0 | 1 | 2;
}
