"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { QrCard, type QrCardData } from "@/components/qr/QrCard";

export default function NewStudentPage() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [collegeType, setCollegeType] = useState<"INNER" | "OUTER">("INNER");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [qrData, setQrData] = useState<QrCardData | null>(null);

  const collegeName = collegeType === "INNER" ? "PPG Institute of Technology" : "Outer College";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setQrData(null);
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, collegeType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to generate food token.");
        setLoading(false);
        return;
      }
      setQrData({
        qrPayload: data.student.qrPayload,
        collegeType: data.student.collegeType,
        collegeName: data.student.collegeName,
        maskedPhone: data.student.maskedPhone,
        qrStatus: data.student.qrStatus,
        createdAt: data.student.createdAt,
      });
      setPhoneNumber("");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setQrData(null);
    setError(null);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-1 text-xl font-bold text-slate-900">Register Student</h2>
      <p className="mb-6 text-sm text-slate-500">
        Generate a secure, one-time food token QR code for a symposium participant.
      </p>

      {!qrData ? (
        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
        >
          {error && (
            <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="phone" className="mb-1 block text-sm font-semibold text-slate-800">
              Phone Number <span className="text-rose-500">*</span>
            </label>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              required
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/[^\d+\s-]/g, ""))}
              placeholder="9876543210"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <p className="mt-1 text-xs text-slate-400">10-digit Indian mobile number.</p>
          </div>

          <fieldset>
            <legend className="mb-2 block text-sm font-semibold text-slate-800">
              College Type <span className="text-rose-500">*</span>
            </legend>
            <div className="space-y-3">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
                <input
                  type="radio"
                  name="collegeType"
                  value="INNER"
                  checked={collegeType === "INNER"}
                  onChange={() => setCollegeType("INNER")}
                  className="h-4 w-4"
                />
                <span className="text-sm font-medium text-slate-800">Inner College</span>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
                <input
                  type="radio"
                  name="collegeType"
                  value="OUTER"
                  checked={collegeType === "OUTER"}
                  onChange={() => setCollegeType("OUTER")}
                  className="h-4 w-4"
                />
                <span className="text-sm font-medium text-slate-800">Outer College</span>
              </label>
            </div>
          </fieldset>

          <div>
            <p className="mb-1 block text-sm font-semibold text-slate-800">College Name</p>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {collegeName}
            </div>
          </div>

          <Button type="submit" disabled={loading} size="lg" className="w-full">
            {loading ? "Generating…" : "GENERATE FOOD TOKEN"}
          </Button>
        </form>
      ) : (
        <div>
          <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Food token generated successfully.
          </div>
          <QrCard data={qrData} />
          <div className="mt-6 text-center">
            <Button variant="ghost" onClick={handleReset}>
              Register another student
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
