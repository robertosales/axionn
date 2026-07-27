import type{QualityResultStatus}from"../types/quality.types";
export function deriveRunItemStatus(statuses:QualityResultStatus[]):QualityResultStatus{if(!statuses.length)return"not_run";if(statuses.includes("failed"))return"failed";if(statuses.includes("blocked"))return"blocked";if(statuses.every(s=>s==="passed"))return"passed";if(statuses.every(s=>s==="skipped"))return"skipped";if(statuses.some(s=>s!=="not_run"))return"in_progress";return"not_run";}
const TERMINAL_STATUSES: ReadonlySet<string> = new Set(["passed","failed","blocked","skipped","invalid"]);
export function isTerminalStatus(status: string): boolean { return TERMINAL_STATUSES.has(status); }
export const RUN_ITEM_ACTIVE_STATUSES = ["not_run","in_progress","retest"] as const;
