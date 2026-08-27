"use client";

import { Check, Copy } from "lucide-react";
import { useState, type JSX } from "react";
import { Button, Dialog, Input } from "@taskflow/ui";

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
 * Renders the confirmText guard's target string as inline `code` (matching
 * Markdown's backtick style) with a one-click copy button - typing an exact
 * org name/email by hand is error-prone, so let the user copy-paste it
 * instead.
 */
function CopyableConfirmText({ text }: { text: string }): JSX.Element {
  const [copied, setCopied] = useState(false);

  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 py-0.5 pl-2 pr-1 align-middle">
      <code className="font-mono text-[0.85em] text-gray-800">{text}</code>
      <button
        type="button"
        onClick={() => {
          if (!("clipboard" in navigator)) return;
          navigator.clipboard
            .writeText(text)
            .then(() => {
              setCopied(true);
              setTimeout(() => {
                setCopied(false);
              }, 1500);
            })
            .catch(() => {
              // Clipboard permission denied/unavailable - no destructive
              // action is blocked by this, the user can still type manually.
            });
        }}
        aria-label={copied ? "Copied" : `Copy "${text}"`}
        className="rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </button>
    </span>
  );
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
        <div className="flex flex-col gap-1.5">
          <p id="confirm-guard-label" className="text-sm font-medium text-gray-700">
            Type <CopyableConfirmText text={confirmText} /> to confirm
          </p>
          <Input
            id="confirm-guard"
            aria-labelledby="confirm-guard-label"
            value={typed}
            onChange={(e) => {
              setTyped(e.target.value);
            }}
            autoComplete="off"
            placeholder={confirmText}
          />
        </div>
      ) : null}
    </Dialog>
  );
}
