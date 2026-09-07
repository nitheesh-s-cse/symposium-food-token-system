"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QrScannerView } from "@/components/scanner/QrScannerView";
import { Button } from "@/components/ui/Button";

type ScanState = "SCANNING" | "CHECKING" | "SUCCESS" | "ALREADY_USED" | "INVALID_TOKEN" | "ERROR";

interface ConsumeResponse {
  ok?: boolean;
  result?: "SUCCESS" | "ALREADY_USED" | "INVALID_TOKEN";
  collegeType?: string | null;
  collegeName?: string | null;
  phoneLast4?: string | null;
  scannedAt?: string | null;
  prevScannedAt?: string | null;
  prevScannerName?: string | null;
  error?: string;
}

export default function ScannerPage() {
  const [state, setState] = useState<ScanState>("SCANNING");
  const [result, setResult] = useState<ConsumeResponse | null>(null);
  const [scannerName, setScannerName] = useState<string>("");
  const [todayCount, setTodayCount] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const busyRef = useRef(false);
  const autoReturnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/scanner/status", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setScannerName(data.scannerName);
        setTodayCount(data.todayCount);
      }
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    const es = new EventSource("/api/stream");
    es.addEventListener("scan-event", () => loadStatus());
    return () => es.close();
  }, [loadStatus]);

  useEffect(() => {
    return () => {
      if (autoReturnTimer.current) clearTimeout(autoReturnTimer.current);
    };
  }, []);

  const handleDetected = useCallback(async (payload: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setState("CHECKING");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/scan/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });
      const data: ConsumeResponse = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error ?? "Scan failed. Please try again.");
        setState("ERROR");
        busyRef.current = false;
        return;
      }

      setResult(data);
      setState(data.result ?? "ERROR");
      if (data.result === "SUCCESS") {
        setTodayCount((c) => c + 1);
      }

      autoReturnTimer.current = setTimeout(() => {
        setState("SCANNING");
        setResult(null);
        busyRef.current = false;
      }, 4000);
    } catch {
      setErrorMessage("Network error. Please try again.");
      setState("ERROR");
      busyRef.current = false;
    }
  }, []);

  function handleScanNext() {
    if (autoReturnTimer.current) clearTimeout(autoReturnTimer.current);
    setState("SCANNING");
    setResult(null);
    setErrorMessage(null);
    busyRef.current = false;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">Scanner</p>
            <p className="font-semibold">{scannerName || "Loading…"}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Today&apos;s Scans</p>
            <p className="text-2xl font-bold text-emerald-400">{todayCount}</p>
          </div>
        </div>
      </div>

      {state === "SCANNING" || state === "CHECKING" ? (
        <div className="space-y-3">
          <p className="text-center text-sm font-medium text-slate-300">
            {state === "CHECKING" ? "Verifying token…" : "Point the camera at a food token QR code"}
          </p>
          <QrScannerView active={state === "SCANNING"} onDetected={handleDetected} />
        </div>
      ) : state === "SUCCESS" ? (
        <SuccessScreen result={result} scannerName={scannerName} onScanNext={handleScanNext} />
      ) : state === "ALREADY_USED" ? (
        <AlreadyUsedScreen result={result} onScanNext={handleScanNext} />
      ) : state === "INVALID_TOKEN" ? (
        <InvalidScreen onScanNext={handleScanNext} />
      ) : (
        <GenericErrorScreen message={errorMessage} onScanNext={handleScanNext} />
      )}
    </div>
  );
}

function SuccessScreen({
  result,
  scannerName,
  onScanNext,
}: {
  result: ConsumeResponse | null;
  scannerName: string;
  onScanNext: () => void;
}) {
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-4 rounded-3xl border-4 border-emerald-500 bg-emerald-950/60 p-8 text-center"
    >
      <div className="text-6xl" aria-hidden>
        ✓
      </div>
      <h2 className="text-2xl font-extrabold text-emerald-400">FOOD TOKEN ACCEPTED</h2>
      <dl className="w-full space-y-2 text-left text-sm text-emerald-100">
        <Row label="Phone" value={result?.phoneLast4 ? `******${result.phoneLast4}` : "—"} />
        <Row label="College Category" value={result?.collegeType ?? "—"} />
        <Row label="College Name" value={result?.collegeName ?? "—"} />
        <Row label="Scan Time" value={result?.scannedAt ? new Date(result.scannedAt).toLocaleTimeString() : "—"} />
        <Row label="Scanner" value={scannerName} />
      </dl>
      <Button variant="success" size="lg" className="w-full" onClick={onScanNext}>
        SCAN NEXT
      </Button>
    </div>
  );
}

function AlreadyUsedScreen({ result, onScanNext }: { result: ConsumeResponse | null; onScanNext: () => void }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-4 rounded-3xl border-4 border-rose-500 bg-rose-950/60 p-8 text-center"
    >
      <div className="text-6xl" aria-hidden>
        ✕
      </div>
      <h2 className="text-2xl font-extrabold text-rose-400">ALREADY USED</h2>
      <dl className="w-full space-y-2 text-left text-sm text-rose-100">
        <Row
          label="Originally Scanned"
          value={result?.prevScannedAt ? new Date(result.prevScannedAt).toLocaleString() : "Unknown"}
        />
        <Row label="Original Scanner" value={result?.prevScannerName ?? "Unknown"} />
      </dl>
      <Button variant="danger" size="lg" className="w-full" onClick={onScanNext}>
        SCAN AGAIN
      </Button>
    </div>
  );
}

function InvalidScreen({ onScanNext }: { onScanNext: () => void }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-4 rounded-3xl border-4 border-rose-500 bg-rose-950/60 p-8 text-center"
    >
      <div className="text-6xl" aria-hidden>
        ✕
      </div>
      <h2 className="text-2xl font-extrabold text-rose-400">INVALID QR</h2>
      <p className="text-sm text-rose-100">This food token is not valid.</p>
      <Button variant="danger" size="lg" className="w-full" onClick={onScanNext}>
        SCAN AGAIN
      </Button>
    </div>
  );
}

function GenericErrorScreen({ message, onScanNext }: { message: string | null; onScanNext: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 rounded-3xl border-4 border-amber-500 bg-amber-950/60 p-8 text-center"
    >
      <div className="text-6xl" aria-hidden>
        !
      </div>
      <h2 className="text-xl font-extrabold text-amber-400">SCAN ERROR</h2>
      <p className="text-sm text-amber-100">{message ?? "Something went wrong. Please try again."}</p>
      <Button variant="secondary" size="lg" className="w-full" onClick={onScanNext}>
        TRY AGAIN
      </Button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-white/10 pb-1">
      <dt className="opacity-70">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
