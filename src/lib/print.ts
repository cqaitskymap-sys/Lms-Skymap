/**
 * Print HTML without opening a popup (uses a hidden iframe).
 * Avoids Chrome popup blockers that block window.open().
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function printHtml(html: string, title = "Print"): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const existing = document.getElementById("lms-print-frame");
  if (existing) existing.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "lms-print-frame";
  iframe.setAttribute("title", title);
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    throw new Error("Unable to prepare print view");
  }

  doc.open();
  doc.write(html);
  doc.close();

  const triggerPrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      // Keep frame briefly so Chrome can finish opening the print dialog
      window.setTimeout(() => {
        iframe.remove();
      }, 1500);
    }
  };

  // Wait for images/styles to settle before printing
  const images = Array.from(doc.images || []);
  if (images.length === 0) {
    window.setTimeout(triggerPrint, 100);
    return;
  }

  let remaining = images.length;
  const done = () => {
    remaining -= 1;
    if (remaining <= 0) window.setTimeout(triggerPrint, 50);
  };
  images.forEach((img) => {
    if (img.complete) done();
    else {
      img.addEventListener("load", done);
      img.addEventListener("error", done);
    }
  });
  // Safety timeout if an image never settles
  window.setTimeout(triggerPrint, 2000);
}
