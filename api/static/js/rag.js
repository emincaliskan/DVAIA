async function loadRagDocuments() {
  const r = await fetch(API + "/documents", { credentials: "include" });
  const data = await r.json().catch(() => ({}));
  const sel = document.getElementById("rag_doc_select");
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

document.getElementById("rag_btn_add_chunk").addEventListener("click", async () => {
  const source = document.getElementById("rag_chunk_source").value.trim() || "manual";
  const content = document.getElementById("rag_chunk_content").value.trim();
  const statusEl = document.getElementById("rag_add_chunk_status");
  if (!content) {
    statusEl.textContent = "Enter content.";
    return;
  }
  statusEl.textContent = "Adding…";
  try {
    const r = await fetch(API + "/rag/chunks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ source, content }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      statusEl.textContent = data.error || r.statusText || "Failed";
      return;
    }
    statusEl.textContent = "Added (id " + (data.id || "") + ").";
    document.getElementById("rag_chunk_content").value = "";
  } catch (err) {
    statusEl.textContent = err.message || "Network error";
  }
});

document.getElementById("rag_btn_add_document").addEventListener("click", async () => {
  const docId = document.getElementById("rag_doc_select").value;
  const statusEl = document.getElementById("rag_add_doc_status");
  if (!docId) {
    statusEl.textContent = "Select a document first.";
    return;
  }
  statusEl.textContent = "Adding…";
  try {
    const r = await fetch(API + "/rag/add-document/" + docId, {
      method: "POST",
      credentials: "include",
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      statusEl.textContent = data.error || r.statusText || "Failed";
      return;
    }
    const source = data.source || "document";
    const len = data.content_length != null ? data.content_length : 0;
    const n = data.chunks_added != null ? data.chunks_added : 0;
    statusEl.textContent = "Added \u201c" + source + "\u201d as " + n + " chunk(s) with embeddings. Query with natural language (e.g. Who created this document?).";
  } catch (err) {
    statusEl.textContent = err.message || "Network error";
  }
});

document.getElementById("rag_btn_chat").addEventListener("click", async () => {
  const prompt = document.getElementById("rag_chat_prompt").value.trim();
  if (!prompt) {
    setOutput("output_rag", "Enter your prompt.", "error");
    return;
  }
  setLoading("output_rag", "rag_btn_chat", true);
  try {
    const body = { prompt, context_from: "rag", rag_query: prompt };
    const r = await fetch(API + "/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      setOutput("output_rag", data.error || r.statusText, "error");
      appendTerminalLine("RAG chat (error)", "fail");
      appendTerminalJson(data);
      return;
    }
    setOutput("output_rag", data.response ?? "", "");
    appendTerminalLine("RAG chat response", "muted");
    appendTerminalJson(data);
  } catch (err) {
    setOutput("output_rag", err.message || "Network error", "error");
    appendTerminalLine("RAG chat: " + (err.message || "Network error"), "fail");
  } finally {
    setLoading("output_rag", "rag_btn_chat", false);
  }
