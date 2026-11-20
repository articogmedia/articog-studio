"use client";

import { createContext, useContext } from "react";

export const StudioBalanceContext = createContext(null);

export function useStudioBalance() {
  return useContext(StudioBalanceContext);
}
