import { memo, useEffect, useRef } from "react";
import markup from "../payments/agent-payments.html?raw";
import { mountAgentPayments } from "../payments/agent-payments";

// The shared controller owns the generated form values after mount.
const trustedMarkup = { __html: markup };

function AgentPayments() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (root.current) return mountAgentPayments(root.current);
  }, []);

  // Build-time, trusted template, shared with the file:// edition. No user HTML.
  return <div ref={root} dangerouslySetInnerHTML={trustedMarkup} />;
}

export default memo(AgentPayments);
