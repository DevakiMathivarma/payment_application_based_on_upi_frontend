// myqr.js
const API_BASE = "https://payment-application-based-on-upi-backend-12jg.onrender.com/api";
document.addEventListener("DOMContentLoaded", async () => {
  const imgEl = document.getElementById("qr-img");
const shareBtn = document.getElementById("share-btn");
const downloadBtn = document.getElementById("download-btn");
  const statusEl = document.getElementById("qr-status");

  const API_SRC = imgEl ? imgEl.getAttribute("src") : `${API_BASE}/qr/myqr/`;
  const token = localStorage.getItem("gapytoken");
  const fallbackValue = localStorage.getItem("my_upi") || "gapy://bank?bank_id=123&name=Arjun";

  function setStatus(msg, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.style.color = isError ? "#ffb3b3" : "";
  }

  async function tryLoadServerImage() {
    try {
      const headers = token ? { "Authorization": `Token ${token}` } : {};
      const resp = await fetch(API_SRC, { headers, cache: "no-cache" });
      if (!resp.ok) {
        console.warn("Server QR fetch not ok:", resp.status);
        return { ok: false, status: resp.status };
      }
      const contentType = resp.headers.get("content-type") || "";
      // If server returned JSON describing a URL, try to use it
      if (!contentType.startsWith("image/")) {
        const text = await resp.text().catch(()=>null);
        try {
          const j = JSON.parse(text);
          if (j && j.url) {
            if (imgEl) imgEl.src = j.url;
            setStatus("QR loaded from server (URL)");
            return { ok: true, type: "url" };
          }
        } catch(e) { /* not JSON */ }
        console.warn("Server response is not an image:", contentType);
        return { ok: false, status: resp.status };
      }
      const blob = await resp.blob();
      const objectUrl = URL.createObjectURL(blob);
      if (imgEl) {
        imgEl.src = objectUrl;
        setStatus("QR loaded from server");
      } else {
        const wrapper = document.querySelector(".qr-image");
        if (wrapper) {
          const i = document.createElement("img");
          i.id = "qr-img";
          i.src = objectUrl;
          i.alt = "My QR code";
          wrapper.appendChild(i);
        }
        setStatus("QR loaded from server");
      }
      return { ok: true, type: "blob", blob };
    } catch (err) {
      console.error("Error fetching server QR:", err);
      return { ok: false, error: err };
    }
  }

  // Generates a canvas element with a QR inside using qrcode.min.js
  async function generateQrCanvas(text) {
    if (typeof QRCode === "undefined" || !QRCode.toCanvas) {
      console.error("QRCode library not found (qrcode.min.js is required)");
      setStatus("QR library missing", true);
      return null;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 300;
    try {
      await QRCode.toCanvas(canvas, text, { width: 300, margin: 2 });
      return canvas;
    } catch (err) {
      console.error("QR generation failed", err);
      setStatus("Failed to generate QR", true);
      return null;
    }
  }

  // Replace existing <img> (if any) with a canvas
  function replaceImageWithCanvas(canvas) {
    const wrapper = document.querySelector(".qr-image");
    if (!wrapper) return;
    const old = wrapper.querySelector("img");
    if (old) old.remove();
    wrapper.appendChild(canvas);
    setStatus("QR generated locally");
  }

  // Helper to get dataURL regardless of source (img blob or canvas)
  function getCurrentDataUrl() {
    // prefer canvas if present
    const canvas = document.querySelector(".qr-image canvas");
    if (canvas) return canvas.toDataURL("image/png");

    const img = document.querySelector(".qr-image img");
    if (img) {
      // draw img to an offscreen canvas to get dataURL
      const c = document.createElement("canvas");
      const w = img.naturalWidth || 300;
      const h = img.naturalHeight || 300;
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      return c.toDataURL("image/png");
    }
    throw new Error("No QR available");
  }

  // Wire the download button
  function wireDownload() {
    if (!downloadBtn) return;
    downloadBtn.addEventListener("click", async () => {
      try {
        // If server image loaded via blob URL, try to fetch the original API or use dataURL
        const canvas = document.querySelector(".qr-image canvas");
        if (canvas) {
          const dataUrl = canvas.toDataURL("image/png");
          const a = document.createElement("a");
          a.href = dataUrl;
          a.download = "gapy-qr.png";
          document.body.appendChild(a);
          a.click();
          a.remove();
          setStatus("Downloaded");
          return;
        }

        const img = document.querySelector(".qr-image img");
        if (img) {
          // attempt to fetch the current img src (use token if API path)
          const src = img.src;
          // if it's an object URL already created from blob we can't re-fetch it; use canvas fallback
          if (src.startsWith("blob:") || src.startsWith("data:")) {
            // convert to dataURL via canvas
            const dataUrl = getCurrentDataUrl();
            const a = document.createElement("a");
            a.href = dataUrl;
            a.download = "gapy-qr.png";
            a.click();
            setStatus("Downloaded");
            return;
          }
          // else fetch the image (may require auth)
          const headers = token ? { "Authorization": `Token ${token}` } : {};
          const resp = await fetch(src, { headers, cache: "no-store" });
          if (!resp.ok) { setStatus("Download failed", true); return; }
          const blob = await resp.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "gapy-qr.png";
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          setStatus("Downloaded");
          return;
        }

        setStatus("No QR to download", true);
      } catch (err) {
        console.error("Download error", err);
        setStatus("Download failed", true);
      }
    });
  }

  // Wire the share button
  function wireShare() {
    if (!shareBtn) return;
    shareBtn.addEventListener("click", async () => {
      try {
        const canvas = document.querySelector(".qr-image canvas");
        const img = document.querySelector(".qr-image img");

        // create a blob to share
        let blob;
        if (canvas) {
          const dataUrl = canvas.toDataURL("image/png");
          blob = await (await fetch(dataUrl)).blob();
        } else if (img) {
          const src = img.src;
          if (src.startsWith("blob:") || src.startsWith("data:")) {
            const dataUrl = getCurrentDataUrl();
            blob = await (await fetch(dataUrl)).blob();
          } else {
            const headers = token ? { "Authorization": `Token ${token}` } : {};
            const resp = await fetch(src, { headers, cache: "no-cache" });
            if (!resp.ok) { setStatus("Share failed", true); return; }
            blob = await resp.blob();
          }
        } else {
          setStatus("No QR to share", true);
          return;
        }

        const file = new File([blob], "gapy-qr.png", { type: blob.type || "image/png" });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "My Gapy QR",
            text: "Scan to pay me"
          });
          setStatus("Shared successfully");
        } else if (navigator.share) {
          // fallback: share text with a page/url (less ideal)
          await navigator.share({ title: "My Gapy QR", text: "Scan to pay me" });
          setStatus("Shared (text)"); 
        } else {
          // last resort: copy a URL or dataURL to clipboard
          try {
            const dataUrl = getCurrentDataUrl();
            await navigator.clipboard.writeText(dataUrl);
            setStatus("QR image copied to clipboard");
          } catch (err) {
            // fallback: copy page url + api path
            try {
              await navigator.clipboard.writeText(window.location.origin + API_SRC);
              setStatus("QR link copied to clipboard");
            } catch (e) {
              setStatus("Share not available", true);
            }
          }
        }
      } catch (err) {
        console.error("Share error", err);
        setStatus("Share failed", true);
      }
    });
  }

  // Run main flow
  setStatus("Loading QR...");
  const loaded = await tryLoadServerImage();
  if (loaded.ok) {
    console.log('workingscan')
    // server provided an image; wire actions
    wireDownload();
    wireShare();
    setStatus("QR loaded from server");
    return;
  }

  // fallback: generate a QR locally
  setStatus("Server QR not available — generating locally...");
  const canvas = await generateQrCanvas(fallbackValue);
  if (canvas) {
     console.log('notworkingscan')
    replaceImageWithCanvas(canvas);
    wireDownload();
    wireShare();
    setStatus("QR generated locally");
  } else {
    setStatus("Unable to load or generate QR", true);
  }
});
