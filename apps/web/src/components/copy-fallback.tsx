"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

export function CopyFallback({
  text,
  label,
  onClose,
}: {
  text: string;
  label: string;
  onClose: () => void;
}) {
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  // Remember what opened the dialog and give focus back when it closes.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    const node = areaRef.current;
    if (!node) return;
    node.focus();
    node.select();
  }, [text]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeRef.current();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), textarea, input, select, a[href], [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="copy-fallback-title"
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center"
    >
      <div className="w-full max-w-lg rounded-2xl bg-background p-5 shadow-lg">
        <h2 id="copy-fallback-title" className="text-lg font-semibold">
          Copy {label}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This browser blocked automatic copy. Tap the box, then copy.
        </p>
        <textarea
          ref={areaRef}
          readOnly
          value={text}
          className="mt-3 min-h-32 w-full rounded-lg border border-input bg-background px-3 py-2 text-base"
        />
        <div className="mt-4 flex justify-end">
          <Button className="min-h-11" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
