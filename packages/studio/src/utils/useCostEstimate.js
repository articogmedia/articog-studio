"use client";

import { useMemo } from "react";
import { estimateCredits } from "../pricing";

export function useCostEstimate(modelId, settings = {}) {
  const { resolution, duration, quality, batchSize } = settings;

  return useMemo(
    () => estimateCredits(modelId, { resolution, duration, quality, batchSize }),
    [modelId, resolution, duration, quality, batchSize],
  );
}
