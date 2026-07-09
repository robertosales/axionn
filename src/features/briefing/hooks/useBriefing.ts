import { useCallback, useState } from "react";
import {
  createBriefing,
  getBriefing,
  processBriefing,
  reviewBriefingSuggestion,
  type BriefingRecord,
  type CreateBriefingInput,
} from "../services/briefing.service";

export function useBriefing() {
  const [briefing, setBriefing] = useState<BriefingRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (briefingId: string) => {
    const loaded = await getBriefing(briefingId);
    setBriefing(loaded);
    return loaded;
  }, []);

  const createAndProcess = useCallback(
    async (input: CreateBriefingInput) => {
      setCreating(true);
      setError(null);
      try {
        const briefingId = await createBriefing(input);
        await processBriefing(briefingId);
        return await refresh(briefingId);
      } catch (cause) {
        const message =
          cause instanceof Error
            ? cause.message
            : "Não foi possível processar o briefing.";
        setError(message);
        throw cause;
      } finally {
        setCreating(false);
      }
    },
    [refresh],
  );

  const review = useCallback(
    async (
      suggestionId: string,
      status: "approved" | "edited" | "rejected",
      payload?: Record<string, unknown>,
    ) => {
      if (!briefing) return;
      setReviewingId(suggestionId);
      setError(null);
      try {
        await reviewBriefingSuggestion(suggestionId, status, payload);
        await refresh(briefing.id);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível revisar a sugestão.",
        );
        throw cause;
      } finally {
        setReviewingId(null);
      }
    },
    [briefing, refresh],
  );

  const reset = useCallback(() => {
    setBriefing(null);
    setError(null);
  }, []);

  return {
    briefing,
    creating,
    reviewingId,
    error,
    createAndProcess,
    review,
    reset,
  };
}
