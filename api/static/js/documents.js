async function loadDocuments() {
  const r = await fetch(API + "/documents", { credentials: "include" });
  const data = await r.json().catch(() => ({}));
  const sel = document.getElementById("doc_select");
  const first = sel.options[0];
  sel.innerHTML = "";
  sel.appendChild(first);
  (data.documents || []).forEach(d => {
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = d.filename + " (id " + d.id + ")";
    sel.appendChild(opt);
  });
}

document.getElementById("btn_upload").addEventListener("click", async () => {
  const input = document.getElementById("doc_file");
  const status = document.getElementById("upload_status");
  if (!input.files || !input.files[0]) {
    status.textContent = "Select a file first.";
    return;
  }
  status.textContent = "Uploading…";
  const form = new FormData();
  form.append("file", input.files[0]);
  const r = await fetch(API + "/documents/upload", {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    status.textContent = data.error || "Upload failed";
    return;
  }
  status.textContent = "Uploaded (id " + data.document_id + ")";
  input.value = "";
  loadDocuments();
});

document.getElementById("send_document").addEventListener("click", async () => {
  const docId = document.getElementById("doc_select").value;
  const prompt = document.getElementById("prompt_document").value.trim();
  if (!prompt) return;
  if (!docId) {
    setOutput("output_document", "Select a document first.", "error");
    return;
  }
  setLoading("output_document", "send_document", true);
  try {
    const body = { prompt, context_from: "upload", document_id: parseInt(docId, 10) };
    const r = await fetch(API + "/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      setOutput("output_document", data.error || r.statusText, "error");
      appendTerminalLine("Document chat (error)", "fail");
      appendTerminalJson(data);
      return;
    }
    setOutput("output_document", data.response ?? "", "");
    appendTerminalLine("Document chat response", "muted");
    appendTerminalJson(data);
  } catch (err) {
    setOutput("output_document", err.message || "Network error", "error");
    appendTerminalLine("Document chat: " + (err.message || "Network error"), "fail");
  } finally {
    setLoading("output_document", "send_document", false);
  }
