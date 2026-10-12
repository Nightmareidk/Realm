"use client";

import { createContext, type MouseEvent, useContext } from "react";

/** Here now's panel, as the frame owns it: whether it's showing, and a way to toggle it. */
export interface HerePanel {
  open: boolean;
  toggle: (e: MouseEvent<HTMLButtonElement>) => void;
}

export const HerePanelContext = createContext<HerePanel>({ open: false, toggle: () => {} });

export const useHerePanel = () => useContext(HerePanelContext);
