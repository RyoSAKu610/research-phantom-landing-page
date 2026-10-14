import type { IncomingMessage, ServerResponse } from "node:http";

export function createResearchApi(): (req: IncomingMessage, res: ServerResponse, next: () => void) => void;
