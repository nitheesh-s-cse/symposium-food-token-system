"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface StudentRow {
  id: string;
  phoneNumber: string;
  collegeType: string;
  collegeName: string;
  qrStatus: string;
  createdAt: string;
  scannedAt: string | null;
  scannerName: string | null;
}

export default function StudentsPage() {
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [search, setSearch] = useState("");
  const [collegeType, setCollegeType] = useState<"ALL" | "INNER" | "OUTER">("ALL");
  const [qrStatus, setQrStatus] = useState<"ALL" | "UNUSED" | "USED">("ALL");
  const [sortBy, setSortBy] = useState<"created_at" | "scanned_at" | "college_type" | "qr_status">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        collegeType,
        qrStatus,
        sortBy,
        sortDir,
      });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/students?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load students.");
        return;
      }
      setRows(data.rows);
      setTotal(data.total);
    } catch {
      setError("Network error while loading students.");
    } finally {
      setLoading(false);
    }
  }, [page, search, collegeType, qrStatus, sortBy, sortDir]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function toggleSort(column: typeof sortBy) {
    if (sortBy === column) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir("desc");
    }
    setPage(1);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-900">Students</h2>
        <a href="/api/export/students">
          <Button variant="success">Export Students to Excel</Button>
        </a>
      </div>

      <div className="mb-4 flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <input
          type="text"
          placeholder="Search by phone (last digits)"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="min-w-[220px] flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
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
          value={qrStatus}
          onChange={(e) => {
            setQrStatus(e.target.value as typeof qrStatus);
            setPage(1);
          }}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="ALL">All Statuses</option>
          <option value="UNUSED">Unused</option>
          <option value="USED">Used</option>
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
              <th className="px-4 py-3">Phone Number</th>
              <SortableTh label="College Type" column="college_type" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} />
              <th className="px-4 py-3">College Name</th>
              <SortableTh label="QR Status" column="qr_status" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} />
              <SortableTh label="Created At" column="created_at" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} />
              <SortableTh label="Scanned At" column="scanned_at" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} />
              <th className="px-4 py-3">Scanner Name</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  No students found.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-mono">{row.phoneNumber}</td>
                  <td className="px-4 py-3">{row.collegeType}</td>
                  <td className="px-4 py-3">{row.collegeName}</td>
                  <td className="px-4 py-3">
                    <Badge variant={row.qrStatus === "USED" ? "danger" : "success"}>{row.qrStatus}</Badge>
                  </td>
                  <td className="px-4 py-3">{new Date(row.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">{row.scannedAt ? new Date(row.scannedAt).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3">{row.scannerName ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Page {page} of {totalPages} · {total} student{total === 1 ? "" : "s"}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

function SortableTh({
  label,
  column,
  sortBy,
  sortDir,
  onClick,
}: {
  label: string;
  column: "created_at" | "scanned_at" | "college_type" | "qr_status";
  sortBy: string;
  sortDir: string;
  onClick: (c: "created_at" | "scanned_at" | "college_type" | "qr_status") => void;
}) {
  const active = sortBy === column;
  return (
    <th className="px-4 py-3">
      <button
        type="button"
        onClick={() => onClick(column)}
        className="flex items-center gap-1 font-medium uppercase text-slate-500 hover:text-slate-800"
      >
        {label}
        {active && <span aria-hidden>{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    </th>
  );
}
