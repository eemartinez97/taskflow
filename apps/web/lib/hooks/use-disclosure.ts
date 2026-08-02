"use client";

import { useCallback, useState } from "react";

export interface DisclosureState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

/**
 * Reusable open/close state hook.
 * Eliminates repeated `const [open, setOpen] = useState(false)` + handlers
 * across every dialog, panel, and dropdown in the app.
 *
 * Usage:
 *   const dialog = useDisclosure();
 *   <Button onClick={dialog.open}>Open</Button>
 *   <Dialog open={dialog.isOpen} onClose={dialog.close} ... />
 */
export function useDisclosure(initialOpen = false): DisclosureState {
  const [isOpen, setIsOpen] = useState(initialOpen);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((p) => !p);
  }, []);

  return { isOpen, open, close, toggle };
}
