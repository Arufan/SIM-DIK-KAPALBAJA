// One-tap PDF export via html2pdf.js (lazy import — heavy chunk, precached by
// the service worker so it works offline after first use).
//
// The report is shown full-screen as a live preview while html2canvas renders
// it — html2canvas fails on detached/off-screen nodes, so the report must be
// a normally-laid-out, visible element during capture.
export async function exportHtmlToPdf(node, filename) {
  const { default: html2pdf } = await import("html2pdf.js");

  const shell = document.createElement("div");
  shell.style.cssText =
    "position:fixed;inset:0;z-index:99;background:#ffffff;overflow:auto;padding:24px;box-sizing:border-box;";
  const content = document.createElement("div");
  content.style.cssText =
    "width:720px;margin:0 auto;background:#ffffff;font-family:'Manrope Variable',Arial,sans-serif;color:#101814;";
  // Clone: the caller keeps its DOM (e.g. the rapor modal must survive export)
  content.appendChild(node.cloneNode(true));
  shell.appendChild(content);
  document.body.appendChild(shell);

  try {
    const worker = html2pdf()
      .set({
        margin: 8,
        filename,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(content);
    window.__pdfDebug = worker;
    // jsPDF triggers the download early; the worker promise can linger on
    // cleanup — never let that block the UI or leave the overlay stuck.
    await Promise.race([
      worker.save(),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout saat membuat PDF")), 25000)),
    ]);
  } finally {
    shell.remove();
    document.querySelectorAll(".html2pdf__overlay").forEach((el) => el.remove());
  }
}

export const escapeHtml = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
