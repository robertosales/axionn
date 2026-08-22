import { describe, expect, it } from "vitest";

import {
  BILLING_STATUSES,
  BILLING_STATUS_TRANSITIONS,
  type BillingStatus,
} from "@/backoffice/types/backoffice.types";

const allowedTransitions: ReadonlyArray<readonly [BillingStatus, BillingStatus]> = [
  ["pending", "paid"],
  ["pending", "overdue"],
  ["pending", "cancelled"],
  ["overdue", "paid"],
  ["overdue", "cancelled"],
  ["paid", "refunded"],
];

describe("billing state machine", () => {
  it.each(allowedTransitions)("allows %s -> %s", (current, target) => {
    expect(BILLING_STATUS_TRANSITIONS[current]).toContain(target);
  });

  it("keeps cancelled and refunded terminal", () => {
    expect(BILLING_STATUS_TRANSITIONS.cancelled).toEqual([]);
    expect(BILLING_STATUS_TRANSITIONS.refunded).toEqual([]);
  });

  it("rejects every transition outside the approved graph", () => {
    const allowed = new Set(allowedTransitions.map(([current, target]) => `${current}:${target}`));

    for (const current of BILLING_STATUSES) {
      for (const target of BILLING_STATUSES) {
        expect(BILLING_STATUS_TRANSITIONS[current].includes(target)).toBe(
          allowed.has(`${current}:${target}`),
        );
      }
    }
  });
});
