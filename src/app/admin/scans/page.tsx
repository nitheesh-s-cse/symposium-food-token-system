"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface ScanLogRow {
  id: string;
  studentId: string | null;
  phoneLast4: string | null;
  collegeType: string | null;
  collegeName: string | null;
  scanResult: "SUCCESS" | "ALREADY_USED" | "INVALID_TOKEN";
  scannerName: string | null;
  scannedAt: string;
}

export default function ScanHistoryPage() {
  const [rows, setRows] = useState<ScanLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [date, setDate] = useState("");
  const [scannerName, setScannerName] = useState("");
  const [collegeType, setCollegeType] = useState<"ALL" | "INNER" | "OUTER">("ALL");
  const [result, setResult] = useState<"ALL" | "SUCCESS" | "ALREADY_USED" | "INVALID_TOKEN">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), collegeType, result });
      if (date) params.set("date", date);
      if (scannerName.trim()) params.set("scannerName", scannerName.trim());
      const res = await fetch(`/api/scan-logs?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load scan history.");
        return;
      }
      setRows(data.rows);
      setTotal(data.total);
    } catch {
      setError("Network error while loading scan history.");
    } finally {
      setLoading(false);
    }
  }, [page, date, scannerName, collegeType, result]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const es = new EventSource("/api/stream");
    es.addEventListener("scan-event", () => load());
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const badgeVariant = (r: string) => (r === "SUCCESS" ? "success" : r === "ALREADY_USED" ? "warning" : "danger");

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-900">Scan History</h2>
        <a href="/api/export/scan-logs">
          <Button variant="success">Export Scan History to Excel</Button>
        </a>
      </div>

      <div className="mb-4 flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          type="text"
          placeholder="Scanner name"
          value={scannerName}
          onChange={(e) => {
            setScannerName(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={collegeType}
          onChange={(e) => {
            setCollegeType(e.target.value as typeof collegeType);
            setPage(1);
          }}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="ALL">All Colleges</option>
          <option value="INNER">Inner College</option>
          <option value="OUTER">Outer College</option>
        </select>
        <select
          value={result}
          onChange={(e) => {
            setResult(e.target.value as typeof result);
            setPage(1);
          }}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="ALL">All Results</option>
          <option value="SUCCESS">Success</option>
          <option value="ALREADY_USED">Already Used</option>
          <option value="INVALID_TOKEN">Invalid Token</option>
        </select>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Student (masked)</th>
              <th className="px-4 py-3">College</th>
              <th className="px-4 py-3">Scan Result</th>
              <th className="px-4 py-3">Scanner</th>
              <th className="px-4 py-3">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  No scan records found.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-mono">{row.phoneLast4 ? `******${row.phoneLast4}` : "—"}</td>
                  <td className="px-4 py-3">{row.collegeName ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={badgeVariant(row.scanResult)}>{row.scanResult.replace("_", " ")}</Badge>
                  </td>
                  <td className="px-4 py-3">{row.scannerName ?? "—"}</td>
                  <td className="px-4 py-3">{new Date(row.scannedAt).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Page {page} of {totalPages} · {total} record{total === 1 ? "" : "s"}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
