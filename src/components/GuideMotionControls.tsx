import { useEffect, useRef } from "react";
import { mountMotionControls } from "../character/motion";

export default function GuideMotionControls({ className }: { className?: string }) {
  const marker = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (marker.current) return mountMotionControls(marker.current);
  }, []);
  return <div ref={marker} data-motion-controls="" className={className} />;
}
