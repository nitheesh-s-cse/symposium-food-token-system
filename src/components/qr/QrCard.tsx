"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export interface QrCardData {
  qrPayload: string;
  collegeType: "INNER" | "OUTER";
  collegeName: string;
  maskedPhone: string;
  qrStatus: string;
  createdAt: string;
}

export function QrCard({ data }: { data: QrCardData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const cardId = "printable-qr-card";

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, data.qrPayload, {
      width: 240,
      margin: 2,
      errorCorrectionLevel: "M",
    }).catch(() => {});
    QRCode.toDataURL(data.qrPayload, { width: 480, margin: 2 })
      .then(setDataUrl)
      .catch(() => {});
  }, [data.qrPayload]);

  function handleDownload() {
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `food-token-${data.maskedPhone.replace(/\*/g, "")}.png`;
    link.click();
  }

  function handlePrint() {
    const printContents = document.getElementById(cardId)?.outerHTML;
    if (!printContents) return;
    const printWindow = window.open("", "_blank", "width=420,height=640");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Food Token</title>
          <style>
            body { font-family: system-ui, sans-serif; display:flex; justify-content:center; padding: 24px; }
            .card { border: 2px solid #0f172a; border-radius: 16px; padding: 24px; width: 320px; text-align:center; }
            .eyebrow { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color:#2563eb; font-weight:700; }
            h1 { font-size: 18px; margin: 4px 0 12px; }
            .college { font-size: 15px; font-weight: 600; margin-bottom: 16px; }
            .status { display:inline-block; margin-top: 12px; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; }
            .phone { margin-top: 12px; font-size: 14px; letter-spacing: 0.05em; }
          </style>
        </head>
        <body>${printContents}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  }

  return (
    <div>
      <div
        id={cardId}
        className="mx-auto w-full max-w-sm rounded-2xl border-2 border-slate-900 bg-white p-6 text-center shadow-lg"
      >
        <p className="text-[11px] font-bold uppercase tracking-widest text-blue-600">
          PPG Institute of Technology
        </p>
        <h1 className="mt-1 text-lg font-bold text-slate-900">Symposium Food Token</h1>
        <p className="mt-3 text-base font-semibold text-slate-800">
          {data.collegeType === "INNER" ? "PPG Institute of Technology" : "OUTER COLLEGE"}
        </p>

        <div className="mt-4 flex justify-center">
          <canvas ref={canvasRef} className="rounded-lg" />
        </div>

        <p className="mt-4 font-mono text-sm tracking-widest text-slate-600">{data.maskedPhone}</p>

        <div className="mt-3">
          <Badge variant={data.qrStatus === "USED" ? "danger" : "success"}>{data.qrStatus}</Badge>
        </div>

        <p className="mt-4 text-[11px] text-slate-400">
          This QR code can be scanned only once. Do not share.
        </p>
      </div>

      <div className="mt-5 flex justify-center gap-3">
        <Button onClick={handleDownload} variant="primary">
          Download QR
        </Button>
        <Button onClick={handlePrint} variant="secondary">
          Print QR
        </Button>
      </div>
    </div>
  );
}
