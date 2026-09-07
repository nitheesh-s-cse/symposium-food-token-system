"use client";

import { useEffect, useState, useCallback } from "react";
import { StatCard } from "@/components/ui/Card";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Stats {
  total_students: number;
  inner_students: number;
  outer_students: number;
  total_tokens: number;
  used_tokens: number;
  unused_tokens: number;
  today_success_scans: number;
}

interface DashboardData {
  stats: Stats;
  byScanner: Array<{ scanner_name: string; count: number }>;
  byHour: Array<{ hour_bucket: string; count: number }>;
}

const COLLEGE_COLORS = ["#2563eb", "#f97316"];
const STATUS_COLORS = ["#16a34a", "#94a3b8"];

export function DashboardClient({ initialData }: { initialData: DashboardData }) {
  const [data, setData] = useState<DashboardData>(initialData);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/stats", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      setData({ stats: json.stats, byScanner: json.byScanner, byHour: json.byHour });
    } catch {
      // ignore transient errors
    }
  }, []);

  useEffect(() => {
    const es = new EventSource("/api/stream");
    es.addEventListener("scan-event", () => {
      refresh();
    });
    const poll = setInterval(refresh, 15_000);
    return () => {
      es.close();
      clearInterval(poll);
    };
  }, [refresh]);

  const { stats, byScanner, byHour } = data;

  const collegeSplit = [
    { name: "Inner College", value: stats.inner_students },
    { name: "Outer College", value: stats.outer_students },
  ];
  const usedSplit = [
    { name: "Used", value: stats.used_tokens },
    { name: "Unused", value: stats.unused_tokens },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Total Students" value={stats.total_students} />
        <StatCard label="Inner College" value={stats.inner_students} accent="blue" />
        <StatCard label="Outer College" value={stats.outer_students} accent="amber" />
        <StatCard label="Total Tokens" value={stats.total_tokens} />
        <StatCard label="Used Tokens" value={stats.used_tokens} accent="emerald" />
        <StatCard label="Unused Tokens" value={stats.unused_tokens} accent="slate" />
        <StatCard label="Today's Successful Scans" value={stats.today_success_scans} accent="emerald" hint="Live" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Inner vs Outer College</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={collegeSplit} dataKey="value" nameKey="name" outerRadius={90} label>
                {collegeSplit.map((_, i) => (
                  <Cell key={i} fill={COLLEGE_COLORS[i % COLLEGE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Used vs Unused Tokens</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={usedSplit} dataKey="value" nameKey="name" outerRadius={90} label>
                {usedSplit.map((_, i) => (
                  <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Scans by Time (Today)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byHour}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour_bucket" fontSize={12} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip />
              <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Scans by Scanner</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byScanner}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="scanner_name" fontSize={12} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip />
              <Bar dataKey="count" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
