"use client";

import { useEffect, useRef, useState } from "react";

export function QrScannerView({
  active,
  onDetected,
}: {
  active: boolean;
  onDetected: (text: string) => void;
}) {
  const containerId = "qr-scanner-region";
  const [cameraError, setCameraError] = useState<string | null>(null);
  const onDetectedRef = useRef(onDetected);
  const lastScanRef = useRef<{ text: string; time: number } | null>(null);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let scannerInstance: import("html5-qrcode").Html5Qrcode | null = null;

    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled) return;
      const scanner = new Html5Qrcode(containerId, { verbose: false });
      scannerInstance = scanner;

      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            const now = Date.now();
            const last = lastScanRef.current;
            if (last && last.text === decodedText && now - last.time < 3000) {
              return;
            }
            lastScanRef.current = { text: decodedText, time: now };
            onDetectedRef.current(decodedText);
          },
          () => {
            // Ignore per-frame decode failures; only real errors matter.
          }
        );
      } catch (err) {
        if (cancelled) return;
        setCameraError(humanizeCameraError(err));
      }
    })();

    return () => {
      cancelled = true;
      if (scannerInstance) {
        scannerInstance
          .stop()
          .then(() => scannerInstance?.clear())
          .catch(() => {});
      }
    };
  }, [active]);

  if (cameraError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700">
        <p className="font-semibold">Camera unavailable</p>
        <p className="mt-1">{cameraError}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border-4 border-slate-900 bg-black">
      <div id={containerId} className="mx-auto w-full" />
    </div>
  );
}

function humanizeCameraError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/NotAllowedError|Permission/i.test(message)) {
    return "Camera permission was denied. Please allow camera access in your browser settings and reload.";
  }
  if (/NotFoundError|No camera/i.test(message)) {
    return "No camera was found on this device.";
  }
  if (/NotReadableError/i.test(message)) {
    return "The camera is already in use by another application.";
  }
  return "Unable to access the camera. Please check permissions and try again.";
}
