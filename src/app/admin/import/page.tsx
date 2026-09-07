"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface RowResult {
  rowNumber: number;
  phoneNumberRaw: string;
  collegeTypeRaw: string;
  normalizedPhone?: string;
  collegeType?: "INNER" | "OUTER";
  status: "VALID" | "INVALID" | "DUPLICATE_IN_FILE" | "DUPLICATE_IN_DB";
  errors: string[];
}

interface Summary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
}

export default function ImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [results, setResults] = useState<RowResult[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importOutcome, setImportOutcome] = useState<{ created: number; failed: Array<{ phoneNumber: string; reason: string }> } | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setImportOutcome(null);
    setFileName(file.name);
    setValidating(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      const res = await fetch("/api/students/import/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Validation failed.");
        setResults([]);
        setSummary(null);
        return;
      }
      setResults(data.results);
      setSummary(data.summary);
    } catch {
      setError("Failed to read the file. Please upload a valid CSV or XLSX file.");
    } finally {
      setValidating(false);
    }
  }

  async function handleConfirmImport() {
    setImporting(true);
    setError(null);
    try {
      const validRows = results
        .filter((r): r is RowResult & { normalizedPhone: string; collegeType: "INNER" | "OUTER" } =>
          r.status === "VALID" && !!r.normalizedPhone && !!r.collegeType
        )
        .map((r) => ({ normalizedPhone: r.normalizedPhone, collegeType: r.collegeType }));

      const res = await fetch("/api/students/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: validRows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Import failed.");
        return;
      }
      setImportOutcome({ created: data.created, failed: data.failed });
      setResults([]);
      setSummary(null);
      setFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      setError("Network error during import.");
    } finally {
      setImporting(false);
    }
  }

  function handleReset() {
    setResults([]);
    setSummary(null);
    setFileName(null);
    setError(null);
    setImportOutcome(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div>
      <h2 className="mb-1 text-xl font-bold text-slate-900">Bulk Import Students</h2>
      <p className="mb-6 text-sm text-slate-500">
        Upload a CSV or XLSX file with columns <code className="rounded bg-slate-100 px-1">phone_number</code> and{" "}
        <code className="rounded bg-slate-100 px-1">college_type</code> (INNER or OUTER).
      </p>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileChange}
          className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700"
        />
        {fileName && <p className="mt-2 text-xs text-slate-400">Selected: {fileName}</p>}
        {validating && <p className="mt-2 text-sm text-blue-600">Validating file…</p>}
      </div>

      {error && (
        <div role="alert" className="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {importOutcome && (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
          <h3 className="font-semibold text-emerald-800">Import complete</h3>
          <p className="mt-1 text-sm text-emerald-700">Successfully created: {importOutcome.created}</p>
          {importOutcome.failed.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-semibold text-rose-700">Rejected rows:</p>
              <ul className="mt-1 list-inside list-disc text-sm text-rose-700">
                {importOutcome.failed.map((f, i) => (
                  <li key={i}>
                    {f.phoneNumber}: {f.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {summary && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <SummaryStat label="Total Rows" value={summary.totalRows} />
            <SummaryStat label="Valid Rows" value={summary.validRows} tone="emerald" />
            <SummaryStat label="Invalid Rows" value={summary.invalidRows} tone="rose" />
            <SummaryStat label="Duplicates" value={summary.duplicateRows} tone="amber" />
          </div>

          <div className="mb-6 max-h-96 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Row</th>
                  <th className="px-4 py-2">Phone</th>
                  <th className="px-4 py-2">College Type</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Errors</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((r) => (
                  <tr key={r.rowNumber}>
                    <td className="px-4 py-2">{r.rowNumber}</td>
                    <td className="px-4 py-2 font-mono">{r.phoneNumberRaw}</td>
                    <td className="px-4 py-2">{r.collegeTypeRaw}</td>
                    <td className="px-4 py-2">
                      <Badge variant={r.status === "VALID" ? "success" : r.status === "INVALID" ? "danger" : "warning"}>
                        {r.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">{r.errors.join("; ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleConfirmImport}
              disabled={importing || summary.validRows === 0}
              variant="success"
            >
              {importing ? "Importing…" : `Confirm Import (${summary.validRows} rows)`}
            </Button>
            <Button variant="secondary" onClick={handleReset} disabled={importing}>
              Cancel
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: number; tone?: "emerald" | "rose" | "amber" }) {
  const toneClass = tone === "emerald" ? "text-emerald-600" : tone === "rose" ? "text-rose-600" : tone === "amber" ? "text-amber-600" : "text-slate-900";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}
