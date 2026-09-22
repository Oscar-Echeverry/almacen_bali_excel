import { useEffect, useRef, useState } from "react";
import type { AuditEventType } from "@secure-spreadsheet/shared";
import { api } from "../api/client";

const throttleMs = 4_000;

interface SecurityRestrictionsState {
  blanked: boolean;
  resetBlankScreen: () => void;
}

interface SecurityRestrictionsOptions {
  onCaptureBlocked?: () => void;
}

export function useSecurityRestrictions(resourceType?: string, resourceId?: string, options: SecurityRestrictionsOptions = {}): SecurityRestrictionsState {
  const lastSent = useRef(new Map<AuditEventType, number>());
  const [blanked, setBlanked] = useState(false);
  const { onCaptureBlocked } = options;

  useEffect(() => {
    const send = (eventType: AuditEventType) => {
      const now = Date.now();
      const previous = lastSent.current.get(eventType) ?? 0;
      if (now - previous < throttleMs) {
        return;
      }
      lastSent.current.set(eventType, now);
      void api.recordSecurityEvent(eventType, resourceType, resourceId).catch(() => undefined);
    };

    const notify = (message: string) => {
      window.dispatchEvent(new CustomEvent("restricted-action", { detail: message }));
    };

    const block = (event: Event, eventType: AuditEventType) => {
      event.preventDefault();
      send(eventType);
      notify("Esta acción está restringida.");
    };

    const blankForCapture = (eventType: AuditEventType) => {
      setBlanked(true);
      send(eventType);
      notify("Captura prohibida. El intento quedó registrado y se cerró el archivo.");
      window.setTimeout(() => onCaptureBlocked?.(), 700);
    };

    const onCopy = (event: ClipboardEvent) => block(event, "COPY_ATTEMPT");
    const onCut = (event: ClipboardEvent) => block(event, "CUT_ATTEMPT");
    const onContextMenu = (event: MouseEvent) => block(event, "CONTEXT_MENU_ATTEMPT");
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "c") {
        block(event, "COPY_ATTEMPT");
      }
      if ((event.ctrlKey || event.metaKey) && key === "x") {
        block(event, "CUT_ATTEMPT");
      }
      if ((event.ctrlKey || event.metaKey) && key === "p") {
        block(event, "PRINT_ATTEMPT");
        blankForCapture("PRINT_ATTEMPT");
      }
      if (event.key === "PrintScreen") {
        event.preventDefault();
        blankForCapture("SCREENSHOT_SIGNAL");
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "PrintScreen") {
        blankForCapture("SCREENSHOT_SIGNAL");
      }
    };
    const onBeforePrint = () => blankForCapture("PRINT_ATTEMPT");
    const onBlur = () => blankForCapture("SCREENSHOT_SIGNAL");
    const onVisibilityChange = () => {
      if (document.hidden) {
        blankForCapture("SCREENSHOT_SIGNAL");
      }
    };

    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [onCaptureBlocked, resourceId, resourceType]);

  return {
    blanked,
    resetBlankScreen: () => setBlanked(false)
  };
}
