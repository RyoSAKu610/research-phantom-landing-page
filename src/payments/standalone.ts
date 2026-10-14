import { mountAgentPayments } from "./agent-payments";

// HTTP(S) is handled by React. file:// uses the pre-rendered fallback edition.
if (window.location.protocol === "file:") mountAgentPayments(document);
