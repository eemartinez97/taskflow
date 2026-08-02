"use client";

import { useState, type JSX } from "react";
import { Button, Dialog, FormField, Input } from "@taskflow/ui";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmText?: string;
  loading?: boolean;
  /** When true the confirm button uses the destructive variant */
  danger?: boolean;
}

/**
 * Reusable confirmation dialog used for every destructive action
 * (delete project, remove member, delete task, etc.).
 *
 * Single source of truth - no copy-pasted "Are you sure?" dialogs.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  confirmText,
  loading = false,
  danger = false,
}: ConfirmDialogProps): JSX.Element {
  const [typed, setTyped] = useState("");

  const handleClose = () => {
    setTyped("");
    onClose();
  };

  const confirmBlocked = confirmText !== undefined && typed !== confirmText;

  const footer = (
    <>
      <Button variant="secondary" onClick={handleClose} disabled={loading}>
        Cancel
      </Button>
      <Button
        variant={danger ? "destructive" : "primary"}
        onClick={onConfirm}
        loading={loading}
        disabled={confirmBlocked || loading}
      >
        {confirmLabel}
      </Button>
    </>
  );

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={title}
      description={description}
      footer={footer}
    >
      {confirmText !== undefined ? (
        <FormField label={`Type "${confirmText}" to confirm`} htmlFor="confirm-guard">
          <Input
            id="confirm-guard"
            value={typed}
            onChange={(e) => {
              setTyped(e.target.value);
            }}
            autoComplete="off"
            placeholder={confirmText}
          />
        </FormField>
      ) : null}
    </Dialog>
  );
}
