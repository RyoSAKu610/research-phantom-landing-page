import { memo, useEffect, useRef } from "react";
import markup from "../research/library.html?raw";
import { mountResearchLibrary } from "../research/library";
import "../research/library.css";

// The DOM controller owns the children after mounting. Never replace them on
// unrelated App state changes (such as selecting a guide in the LP).
const trustedMarkup = { __html: markup };

function ResearchLibrary() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (root.current) return mountResearchLibrary(root.current);
  }, []);

  // Trusted build-time markup, shared with the standalone edition. User text is set in the controller.
  return <div ref={root} dangerouslySetInnerHTML={trustedMarkup} />;
}

export default memo(ResearchLibrary);
