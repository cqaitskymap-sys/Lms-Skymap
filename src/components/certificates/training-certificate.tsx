"use client";

import { forwardRef } from "react";
import { formatDate } from "@/lib/utils";
import type { Certificate } from "@/types";

export interface TrainingCertificateProps {
  certificate: Certificate;
  qrDataUrl?: string;
  /** Compact preview vs full print size */
  compact?: boolean;
}

/**
 * Professional landscape training certificate.
 * Designed for on-screen preview, print, and html2canvas / PDF capture.
 */
export const TrainingCertificate = forwardRef<HTMLDivElement, TrainingCertificateProps>(
  function TrainingCertificate({ certificate, qrDataUrl, compact }, ref) {
    const qr = qrDataUrl || certificate.qrCodeImageUrl;

    return (
      <div
        ref={ref}
        data-certificate
        className={
          compact
            ? "certificate-sheet mx-auto w-full max-w-4xl"
            : "certificate-sheet mx-auto w-full max-w-[1100px]"
        }
        style={{
          aspectRatio: "1.414 / 1",
          fontFamily: '"Cormorant Garamond", "Palatino Linotype", Palatino, serif',
          background:
            "linear-gradient(145deg, #faf8f3 0%, #f3efe6 48%, #faf8f3 100%)",
          color: "#0b3d4a",
        }}
      >
        <div
          className="relative h-full w-full p-[3.5%]"
          style={{ boxSizing: "border-box" }}
        >
          {/* Outer frame */}
          <div
            className="absolute inset-[2.2%] pointer-events-none"
            style={{ border: "2.5px solid #0b3d4a" }}
          />
          <div
            className="absolute inset-[3.2%] pointer-events-none"
            style={{ border: "1px solid #b8944a" }}
          />

          {/* Corner flourishes */}
          {(
            [
              ["top-left", "0", "0"],
              ["top-right", "0", "auto"],
              ["bottom-left", "auto", "0"],
              ["bottom-right", "auto", "auto"],
            ] as const
          ).map(([key, top, left]) => (
            <div
              key={key}
              className="pointer-events-none absolute"
              style={{
                top: top === "0" ? "4%" : "auto",
                bottom: top === "auto" ? "4%" : "auto",
                left: left === "0" ? "4%" : "auto",
                right: left === "auto" ? "4%" : "auto",
                width: 28,
                height: 28,
                borderColor: "#b8944a",
                borderStyle: "solid",
                borderWidth:
                  key === "top-left"
                    ? "2px 0 0 2px"
                    : key === "top-right"
                      ? "2px 2px 0 0"
                      : key === "bottom-left"
                        ? "0 0 2px 2px"
                        : "0 2px 2px 0",
              }}
            />
          ))}

          <div className="relative flex h-full flex-col items-center justify-between text-center">
            {/* Header */}
            <div className="flex w-full flex-col items-center gap-2 pt-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={certificate.companyLogoUrl || "/brand/skymap-logo.svg"}
                alt={certificate.companyName}
                className="h-14 w-14 object-contain"
              />
              <p
                className="text-sm font-semibold tracking-[0.35em] uppercase"
                style={{ color: "#0b3d4a" }}
              >
                {certificate.companyName}
              </p>
              <p
                className="text-[11px] font-medium tracking-[0.4em] uppercase"
                style={{ color: "#b8944a" }}
              >
                Certificate of Training
              </p>
            </div>

            {/* Body */}
            <div className="flex max-w-[85%] flex-col items-center gap-3 py-2">
              <h1
                className="text-4xl font-semibold tracking-tight md:text-5xl"
                style={{ color: "#0b3d4a" }}
              >
                Certificate of Completion
              </h1>
              <div className="h-px w-40" style={{ background: "#b8944a" }} />
              <p className="text-base italic" style={{ color: "#5c6b70" }}>
                This is to certify that
              </p>
              <p
                className="text-3xl font-semibold md:text-4xl"
                style={{ color: "#0b3d4a" }}
              >
                {certificate.employeeName}
              </p>
              <p className="text-sm" style={{ color: "#5c6b70" }}>
                Employee ID{" "}
                <span className="font-semibold" style={{ color: "#0b3d4a" }}>
                  {certificate.employeeCode}
                </span>
                {" · "}
                Department{" "}
                <span className="font-semibold" style={{ color: "#0b3d4a" }}>
                  {certificate.departmentName}
                </span>
              </p>
              <p className="text-base italic" style={{ color: "#5c6b70" }}>
                has successfully completed training on
              </p>
              <p className="text-xl font-semibold md:text-2xl" style={{ color: "#0b3d4a" }}>
                {certificate.sopNumber}
                <span className="mx-2 font-normal" style={{ color: "#b8944a" }}>
                  —
                </span>
                {certificate.sopTitle}
              </p>
              <p className="text-sm" style={{ color: "#5c6b70" }}>
                Trainer:{" "}
                <span className="font-medium" style={{ color: "#0b3d4a" }}>
                  {certificate.trainerName}
                </span>
                {" · "}
                Score:{" "}
                <span className="font-medium" style={{ color: "#0b3d4a" }}>
                  {certificate.percentage}%
                </span>
              </p>
            </div>

            {/* Footer meta + signature + QR */}
            <div className="grid w-full grid-cols-3 items-end gap-4 px-6 pb-2">
              <div className="text-left">
                <p className="text-[10px] uppercase tracking-wider" style={{ color: "#8a9498" }}>
                  Certificate number
                </p>
                <p className="font-mono text-xs font-semibold">{certificate.certificateNumber}</p>
                <p className="mt-2 text-[10px] uppercase tracking-wider" style={{ color: "#8a9498" }}>
                  Issue date
                </p>
                <p className="text-sm font-medium">{formatDate(certificate.issuedAt)}</p>
              </div>

              <div className="flex flex-col items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={certificate.digitalSignatureUrl || "/brand/qa-signature.svg"}
                  alt="Digital signature"
                  className="h-12 w-40 object-contain"
                />
                <div className="mt-1 h-px w-44" style={{ background: "#0b3d4a" }} />
                <p className="mt-1 text-sm font-semibold">
                  {certificate.signedBy || "Authorized Signatory"}
                </p>
                <p className="text-[10px]" style={{ color: "#8a9498" }}>
                  {certificate.signedByTitle || "Digitally signed"} · e-Sign
                </p>
              </div>

              <div className="flex flex-col items-end gap-1">
                {qr && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qr}
                    alt="Verification QR code"
                    className="h-20 w-20 rounded-sm border border-[#0b3d4a]/20 bg-white p-1"
                  />
                )}
                <p className="text-[9px] uppercase tracking-wider" style={{ color: "#8a9498" }}>
                  Scan to verify
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);
