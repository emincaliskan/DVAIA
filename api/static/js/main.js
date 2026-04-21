const API = "/api";

async function getSession() {
  const r = await fetch(API + "/session", { credentials: "include" });
  return r.json();
}

// Terminal output functions
function appendTerminalLine(text, className = "") {
  const terminal = document.getElementById("terminal_output");
  if (!terminal) return;
  const line = document.createElement("div");
  if (className) line.className = "terminal-line " + className;
  line.textContent = text;
  terminal.appendChild(line);
  terminal.scrollTop = terminal.scrollHeight;
}

function appendTerminalJson(data) {
  const terminal = document.getElementById("terminal_output");
  if (!terminal) return;
  const pre = document.createElement("pre");
  pre.className = "terminal-json";
  pre.textContent = JSON.stringify(data, null, 2);
  terminal.appendChild(pre);
  terminal.scrollTop = terminal.scrollHeight;
}

function hideTerminalLog() {
  const terminal = document.getElementById("terminal_output");
  if (terminal) terminal.style.display = "none";
}

function showTerminalLog() {
  const terminal = document.getElementById("terminal_output");
  if (terminal) terminal.style.display = "block";
}

function setOutput(outputElId, text, kind, thinkingText) {
  const outputEl = document.getElementById(outputElId);
  const thinkingEl = document.getElementById(outputElId + "_thinking");
  const tabsEl = document.getElementById("tabs_" + outputElId.replace("output_", ""));

  outputEl.textContent = text || "";
  outputEl.className = "output-box " + (kind || "empty");

  if (thinkingEl) {
    thinkingEl.textContent = thinkingText || "";
    thinkingEl.className = "output-box thinking " + (kind || "empty");
    if (thinkingText) {
      thinkingEl.style.display = "block";
      if (tabsEl) {
        tabsEl.querySelector('[data-tab="thinking"]').style.display = "inline-block";
        tabsEl.querySelector('[data-tab="thinking"]').classList.add("has-content");
      }
    } else {
      thinkingEl.style.display = "none";
      if (tabsEl) {
        tabsEl.querySelector('[data-tab="thinking"]').style.display = "none";
        tabsEl.querySelector('[data-tab="thinking"]').classList.remove("has-content");
        tabsEl.querySelector('[data-tab="answer"]').classList.add("active");
        outputEl.style.display = "block";
      }
    }
  }
  if (tabsEl) showOutputTab(tabsEl, "answer"); // Default to answer tab
}

function setLoading(outputElId, btnId, loading) {
  const btn = document.getElementById(btnId);
  const outputEl = document.getElementById(outputElId);
  const thinkingEl = document.getElementById(outputElId + "_thinking");
  const tabsEl = document.getElementById("tabs_" + outputElId.replace("output_", ""));

  if (btn) btn.disabled = loading;
  if (loading) {
    if (outputEl) {
      outputEl.textContent = "Waiting for response…";
      outputEl.className = "output-box loading";
    }
    if (thinkingEl) {
      thinkingEl.textContent = ""; // Clear thinking box when loading new response
      thinkingEl.style.display = "none"; // Hide thinking tab when loading
    }
    if (tabsEl) {
      tabsEl.querySelector('[data-tab="thinking"]').style.display = "none";
      tabsEl.querySelector('[data-tab="thinking"]').classList.remove("has-content");
      showOutputTab(tabsEl, "answer"); // Always show answer tab when loading
    }
  }
}

function showOutputTab(tabsContainer, tabId) {
  const outputIdPrefix = tabsContainer.id.replace("tabs_", "output_");
  tabsContainer.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.remove("active");
  });
  tabsContainer.querySelector(`[data-tab="${tabId}"]`).classList.add("active");

  document.getElementById(outputIdPrefix).style.display = "none";
  document.getElementById(outputIdPrefix + "_thinking").style.display = "none";

  document.getElementById(outputIdPrefix + (tabId === "thinking" ? "_thinking" : "")).style.display = "block";
}

// Event listeners for output tabs (in main panels, not terminal history)
document.querySelectorAll(".output-tabs:not(.terminal-output-tabs)").forEach(tabsContainer => {
  tabsContainer.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab-btn");
    if (!btn) return;
    showOutputTab(tabsContainer, btn.dataset.tab);
  });
});

let terminalResponseCounter = 0;

function addTerminalResponseToHistory(responseText, thinkingText, modelId) {
  const historyEl = document.getElementById("terminal_response_history");
  if (!historyEl) return;
  
  historyEl.style.display = "block";
  hideTerminalLog();
  
  terminalResponseCounter++;
  const itemId = "terminal_resp_" + terminalResponseCounter;
  
  const item = document.createElement("div");
  item.className = "terminal-response-item";
  item.id = itemId;
  
  // Model label
  const label = document.createElement("div");
  label.className = "terminal-response-label";
  label.textContent = (modelId || "Model") + " • " + new Date().toLocaleTimeString();
  item.appendChild(label);
  
  // Tabs
  const tabs = document.createElement("div");
  tabs.className = "output-tabs terminal-output-tabs";
  tabs.id = "tabs_" + itemId;
  
  const answerBtn = document.createElement("button");
  answerBtn.type = "button";
  answerBtn.className = "tab-btn active";
  answerBtn.dataset.tab = "answer";
  answerBtn.textContent = "Answer";
  
  const thinkingBtn = document.createElement("button");
  thinkingBtn.type = "button";
  thinkingBtn.className = "tab-btn";
  thinkingBtn.dataset.tab = "thinking";
  thinkingBtn.textContent = "Thinking";
  
  tabs.appendChild(answerBtn);
  tabs.appendChild(thinkingBtn);
  
  if (!thinkingText) {
    thinkingBtn.style.display = "none";
  }
  
  // Content boxes
  const answerBox = document.createElement("div");
  answerBox.className = "terminal-response-box terminal-answer";
  answerBox.id = itemId + "_answer";
  answerBox.textContent = responseText || "";
  
  const thinkingBox = document.createElement("div");
  thinkingBox.className = "terminal-response-box terminal-thinking";
  thinkingBox.id = itemId + "_thinking";
  thinkingBox.style.display = "none";
  thinkingBox.textContent = thinkingText || "";
  
  item.appendChild(tabs);
  item.appendChild(answerBox);
  item.appendChild(thinkingBox);
  
  // Tab click handler
  tabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab-btn");
    if (!btn) return;
    tabs.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    if (btn.dataset.tab === "answer") {
      answerBox.style.display = "block";
      thinkingBox.style.display = "none";
    } else {
      answerBox.style.display = "none";
      thinkingBox.style.display = "block";
    }
  });
  
  historyEl.appendChild(item);
  historyEl.scrollTop = historyEl.scrollHeight;
}

function clearTerminalResponseHistory() {
  const historyEl = document.getElementById("terminal_response_history");
  if (historyEl) {
    historyEl.innerHTML = "";
    historyEl.style.display = "none";
  }
  terminalResponseCounter = 0;
}

function showPanel(panelId) {
  document.querySelectorAll("#main_body .panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll("#main_menu li").forEach(li => li.classList.remove("selected"));
  const panel = document.getElementById("panel_" + panelId);
  const menuItem = document.querySelector('#main_menu li[data-panel="' + panelId + '"]');
  if (panel) panel.classList.add("active");
  if (menuItem) menuItem.classList.add("selected");
}

function updateSessionUI(data) {
  const user = data && data.user;
  const userLabel = document.getElementById("user_label");
  const btnLogout = document.getElementById("btn_logout");
  if (user) {
    userLabel.textContent = "Logged in as " + user.username + (user.mfa_verified ? "" : " (MFA required)");
    btnLogout.style.display = "inline-block";
    document.getElementById("panel_login").classList.remove("active");
    if (!user.mfa_verified) {
      document.querySelectorAll("#main_body .panel").forEach(p => p.classList.remove("active"));
      document.getElementById("panel_mfa").classList.add("active");
    } else {
      document.getElementById("panel_mfa").classList.remove("active");
      if (!document.querySelector("#main_body .panel.active")) showPanel("direct");
    }
  } else {
    userLabel.textContent = "";
    btnLogout.style.display = "none";
    document.getElementById("panel_login").classList.remove("active");
    document.getElementById("panel_mfa").classList.remove("active");
  }
}

document.getElementById("main_menu").addEventListener("click", (e) => {
  const li = e.target.closest("li[data-panel]");
  if (li) {
    e.preventDefault();
    showPanel(li.dataset.panel);
    if (li.dataset.panel === "rag") loadRagDocuments();
    if (li.dataset.panel === "payloads") loadPayloadsList();
  }
});

// Login button removed from UI

document.getElementById("btn_logout").addEventListener("click", async () => {
  await fetch(API + "/logout", { method: "POST", credentials: "include" });
  const data = await getSession();
  updateSessionUI(data);
  showPanel("direct");
});

document.getElementById("form_login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("login_error");
  errEl.style.display = "none";
  const username = document.getElementById("login_username").value.trim();
  const password = document.getElementById("login_password").value;
  const r = await fetch(API + "/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username, password }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    errEl.textContent = data.error || "Login failed";
    errEl.style.display = "block";
    return;
  }
  const session = await getSession();
  updateSessionUI(session);
  if (session.user && !session.user.mfa_verified) showPanel("mfa");
  else showPanel("direct");
});

document.getElementById("form_mfa").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("mfa_error");
  errEl.style.display = "none";
  const code = document.getElementById("mfa_code").value.trim();
  const r = await fetch(API + "/mfa", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ code }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    errEl.textContent = data.error || "Invalid code";
    errEl.style.display = "block";
    return;
  }
  const session = await getSession();
  updateSessionUI(session);
  showPanel("direct");
});

function getDirectModelId() {
  return "claude-sonnet-4-6";
}

function getDirectSamplingOptions() {
  const opts = {};
  const t = parseFloat(document.getElementById("opt_temperature")?.value);
  if (!Number.isNaN(t)) opts.temperature = t;
  const k = parseInt(document.getElementById("opt_top_k")?.value, 10);
  if (!Number.isNaN(k)) opts.top_k = k;
  const p = parseFloat(document.getElementById("opt_top_p")?.value);
  if (!Number.isNaN(p)) opts.top_p = p;
  const m = parseInt(document.getElementById("opt_max_tokens")?.value, 10);
  if (!Number.isNaN(m)) opts.max_tokens = m;
  const rp = parseFloat(document.getElementById("opt_repeat_penalty")?.value);
  if (!Number.isNaN(rp)) opts.repeat_penalty = rp;
  return opts;
}

document.getElementById("send_direct").addEventListener("click", async () => {
  const prompt = document.getElementById("prompt_direct").value.trim();
  if (!prompt) return;
  setLoading("output_direct", "send_direct", true);
  const model_id = getDirectModelId();
  const options = getDirectSamplingOptions();
  const body = { prompt, model_id };
  if (Object.keys(options).length) body.options = options;
  appendTerminalLine("Direct chat request", "muted");
  appendTerminalLine("Model: " + model_id, "muted");
  appendTerminalLine("Options: " + (Object.keys(options).length ? JSON.stringify(options) : "(none)"), "muted");
  try {
    const r = await fetch(API + "/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      setOutput("output_direct", data.error || r.statusText, "error");
      appendTerminalLine("Direct chat (error)", "fail");
      appendTerminalJson(data);
      return;
    }
    setOutput("output_direct", data.response ?? "", "", data.thinking ?? "");
    addTerminalResponseToHistory(data.response ?? "", data.thinking ?? "", model_id);
  } catch (err) {
    setOutput("output_direct", err.message || "Network error", "error");
    appendTerminalLine("Direct chat: " + (err.message || "Network error"), "fail");
  } finally {
    setLoading("output_direct", "send_direct", false);
  }
});

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
    setOutput("output_document", data.response ?? "", "", data.thinking ?? "");
    addTerminalResponseToHistory(data.response ?? "", data.thinking ?? "", "Document");
  } catch (err) {
    setOutput("output_document", err.message || "Network error", "error");
    appendTerminalLine("Document chat: " + (err.message || "Network error"), "fail");
  } finally {
    setLoading("output_document", "send_document", false);
  }
});

document.getElementById("send_web").addEventListener("click", async () => {
  let url = document.getElementById("web_url").value.trim();
  const prompt = document.getElementById("prompt_web").value.trim();
  if (!prompt) return;
  if (url && !url.startsWith("http") && !url.startsWith("/")) url = "/" + url;
  if (url && url.startsWith("/")) url = window.location.origin + url;
  if (!url) {
    setOutput("output_web", "Enter a URL (e.g. /evil/ or https://...).", "error");
    return;
  }
  setLoading("output_web", "send_web", true);
  try {
    const body = { prompt, context_from: "url", url };
    const r = await fetch(API + "/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      setOutput("output_web", data.error || r.statusText, "error");
      appendTerminalLine("Web chat (error)", "fail");
      appendTerminalJson(data);
      return;
    }
    setOutput("output_web", data.response ?? "", "", data.thinking ?? "");
    addTerminalResponseToHistory(data.response ?? "", data.thinking ?? "", "Web");
  } catch (err) {
    setOutput("output_web", err.message || "Network error", "error");
    appendTerminalLine("Web chat: " + (err.message || "Network error"), "fail");
  } finally {
    setLoading("output_web", "send_web", false);
  }
});

// Agentic: multi-round conversation state
let agenticMessages = [];
let agenticThinking = "";
let agenticLastToolCalls = [];  // tool names used in the last turn (for summary)
let agenticModelIdCached = null;  // from /api/models agentic_model (env AGENTIC_MODEL)

async function getAgenticModelId() {
  if (agenticModelIdCached) return agenticModelIdCached;
  try {
    const r = await fetch(API + "/models", { credentials: "include" });
    const data = await r.json().catch(() => ({}));
    agenticModelIdCached = data.agentic_model || "claude-sonnet-4-6";
  } catch (_) {
    agenticModelIdCached = "claude-sonnet-4-6";
  }
  return agenticModelIdCached;
}

function parseThinkingIntoSteps(thinkingText) {
  if (!thinkingText || !thinkingText.trim()) return [];
  const steps = [];
  const blocks = thinkingText.split(/\s*---\s*Step\s+\d+\s*---\s*/i).filter(B => B.trim());
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    const stepNum = i + 1;
    let reasoning = "";
    let thought = "";
    const actions = [];
    const lines = block.split("\n");
    let section = "";
    let currentAction = null;
    for (let j = 0; j < lines.length; j++) {
      const line = lines[j];
      if (line.startsWith("Reasoning (CoT):")) {
        section = "reasoning";
        continue;
      }
      if (line.startsWith("Thought:")) {
        section = "thought";
        thought = line.slice(7).trim();
        continue;
      }
      if (line.startsWith("Action:")) {
        if (currentAction) actions.push(currentAction);
        currentAction = { name: line.slice(7).trim(), input: "", observation: "" };
        section = "action";
        continue;
      }
      if (line.startsWith("Action Input:")) {
        if (currentAction) currentAction.input = line.slice(12).trim();
        continue;
      }
      if (line.startsWith("Observation:")) {
        section = "observation";
        if (currentAction) currentAction.observation = line.slice(12).trim();
        continue;
      }
      if (section === "reasoning") reasoning += (reasoning ? "\n" : "") + line;
      else if (section === "observation" && currentAction) currentAction.observation += (currentAction.observation ? "\n" : "") + line;
    }
    if (currentAction) actions.push(currentAction);
    steps.push({ stepNum, reasoning, thought, actions });
  }
  return steps;
}

function renderAgenticConversation() {
  const container = document.getElementById("agentic_conversation");
  if (!container) return;
  if (agenticMessages.length === 0) {
    container.innerHTML = "Conversation will appear here. Send a message to start.";
    container.classList.remove("has-rounds");
    return;
  }
  container.classList.add("has-rounds");
  let html = "";
  for (let i = 0; i < agenticMessages.length; i++) {
    const msg = agenticMessages[i];
    const isLast = i === agenticMessages.length - 1;
    const showThinking = isLast && msg.role === "assistant" && agenticThinking;
    if (msg.role === "user") {
      html += '<div class="agentic-round"><div class="agentic-msg-user"><div class="agentic-role">User</div>' + escapeHtml(msg.content) + "</div></div>";
    } else {
      html += '<div class="agentic-round"><div class="agentic-msg-assistant"><div class="agentic-role">Assistant</div>' + escapeHtml(msg.content || "");
      if (isLast && msg.role === "assistant" && agenticLastToolCalls && agenticLastToolCalls.length > 0) {
        html += '<div class="agentic-tools-used">Tools used: ' + escapeHtml(agenticLastToolCalls.join(", ")) + '</div>';
      }
      if (showThinking) {
        const steps = parseThinkingIntoSteps(agenticThinking);
        const stepId = "agentic_steps_" + Date.now();
        html += '<div class="agentic-thinking-toggle" data-toggle="' + stepId + '">▼ Show thinking (' + steps.length + " step(s))</div>";
        html += '<div id="' + stepId + '" class="agentic-thinking-steps" style="display:none;">';
        steps.forEach(function(s) {
          html += '<div class="agentic-step-block"><div class="agentic-step-title">Step ' + s.stepNum + '</div>';
          if (s.reasoning) html += '<div class="agentic-step-reasoning">Reasoning (CoT): ' + escapeHtml(s.reasoning) + '</div>';
          if (s.thought) html += '<div class="agentic-step-thought">Thought: ' + escapeHtml(s.thought) + '</div>';
          s.actions.forEach(function(a) {
            html += '<div class="agentic-step-action">Action: ' + escapeHtml(a.name) + '</div>';
            if (a.input) html += '<div class="agentic-step-action">Action Input: ' + escapeHtml(a.input) + '</div>';
            if (a.observation) html += '<div class="agentic-step-observation">Observation: ' + escapeHtml(a.observation) + '</div>';
          });
          html += '</div>';
        });
        html += '</div>';
      }
      html += "</div></div>";
    }
  }
  container.innerHTML = html;
  container.scrollTop = container.scrollHeight;
  container.querySelectorAll(".agentic-thinking-toggle").forEach(function(el) {
    el.addEventListener("click", function() {
      const target = document.getElementById(el.getAttribute("data-toggle"));
      if (!target) return;
      if (target.style.display === "none") {
        target.style.display = "block";
        el.textContent = el.textContent.replace("▼", "▲").replace("Show", "Hide");
      } else {
        target.style.display = "none";
        el.textContent = el.textContent.replace("▲", "▼").replace("Hide", "Show");
      }
    });
  });
}

function getAgenticToolNames() {
  const checked = document.querySelectorAll(".agentic-tool-cb:checked");
  const all = document.querySelectorAll(".agentic-tool-cb");
  if (checked.length === 0 || checked.length === all.length) return null;  // all or none = use default (all)
  return Array.from(checked).map(el => el.value);
}

document.querySelectorAll(".agentic-scenario-btn").forEach(function(btn) {
  btn.addEventListener("click", function() {
    const promptEl = document.getElementById("prompt_agentic");
    if (promptEl) promptEl.value = btn.getAttribute("data-prompt") || "";
  });
});

document.getElementById("send_agentic").addEventListener("click", async () => {
  const prompt = document.getElementById("prompt_agentic").value.trim();
  if (!prompt) return;
  setLoading("output_agentic", "send_agentic", true);
  appendTerminalLine("Agentic chat request", "muted");
  const modelId = await getAgenticModelId();
  const toolNames = getAgenticToolNames();
  const maxSteps = parseInt(document.getElementById("agentic_max_steps") && document.getElementById("agentic_max_steps").value, 10) || 15;
  const timeout = parseInt(document.getElementById("agentic_timeout") && document.getElementById("agentic_timeout").value, 10) || 120;
  const body = {
    prompt,
    model_id: modelId,
    messages: agenticMessages,
    max_steps: Math.max(1, Math.min(50, maxSteps)),
    timeout: Math.max(10, Math.min(300, timeout)),
  };
  if (toolNames) body.tool_names = toolNames;
  try {
    const r = await fetch(API + "/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      setOutput("output_agentic", data.error || r.statusText, "error");
      appendTerminalLine("Agentic (error)", "fail");
      appendTerminalJson(data);
      return;
    }
    agenticMessages = data.messages || [];
    agenticThinking = data.thinking || "";
    agenticLastToolCalls = data.tool_calls || [];
    renderAgenticConversation();
    setOutput("output_agentic", data.response ?? "", "", data.thinking ?? "");
    addTerminalResponseToHistory(data.response ?? "", data.thinking ?? "", "Agentic (" + modelId + ")");
    document.getElementById("prompt_agentic").value = "";
  } catch (err) {
    setOutput("output_agentic", err.message || "Network error", "error");
    appendTerminalLine("Agentic: " + (err.message || "Network error"), "fail");
  } finally {
    setLoading("output_agentic", "send_agentic", false);
  }
});

document.getElementById("agentic_new_conversation").addEventListener("click", function() {
  agenticMessages = [];
  agenticThinking = "";
  agenticLastToolCalls = [];
  renderAgenticConversation();
  document.getElementById("prompt_agentic").value = "";
  setOutput("output_agentic", "", "empty", "");
});

document.getElementById("send_template").addEventListener("click", async () => {
  const template = document.getElementById("template_text").value.trim();
  const userInput = document.getElementById("template_user_input").value;
  if (!template) return;
  setLoading("output_template", "send_template", true);
  try {
    const r = await fetch(API + "/chat-with-template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ template, user_input: userInput }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      setOutput("output_template", data.error || r.statusText, "error");
      appendTerminalLine("Template chat (error)", "fail");
      appendTerminalJson(data);
      return;
    }
    setOutput("output_template", data.response ?? "", "", data.thinking ?? "");
    addTerminalResponseToHistory(data.response ?? "", data.thinking ?? "", "Template");
  } catch (err) {
    setOutput("output_template", err.message || "Network error", "error");
    appendTerminalLine("Template: " + (err.message || "Network error"), "fail");
  } finally {
    setLoading("output_template", "send_template", false);
  }
});

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
    setOutput("output_rag", data.response ?? "", "", data.thinking ?? "");
    addTerminalResponseToHistory(data.response ?? "", data.thinking ?? "", "RAG");
  } catch (err) {
    setOutput("output_rag", err.message || "Network error", "error");
    appendTerminalLine("RAG chat: " + (err.message || "Network error"), "fail");
  } finally {
    setLoading("output_rag", "rag_btn_chat", false);
  }
});

function showPayloadOptions(assetType) {
  document.querySelectorAll(".payload-type-options").forEach(el => { el.style.display = "none"; });
  const show = (id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "block";
  };
  if (assetType === "text") show("payload_options_text");
  else if (assetType === "csv") {
    show("payload_options_csv");
    toggleCsvMode();
  }
  else if (assetType === "pdf") show("payload_options_pdf");
  else if (assetType === "image") {
    show("payload_options_image");
    if (typeof schedulePayloadPreview === "function") schedulePayloadPreview();
  }
  else if (assetType === "pdf_metadata") show("payload_options_pdf_metadata");
  else if (assetType === "qr") show("payload_options_qr");
  else if (assetType === "audio_synthetic") show("payload_options_audio_synthetic");
  else if (assetType === "audio_tts") show("payload_options_audio_tts");
}
document.getElementById("payload_asset_type").addEventListener("change", () => {
  showPayloadOptions(document.getElementById("payload_asset_type").value);
});
showPayloadOptions("text");

function toggleCsvMode() {
  const isCustom = document.getElementById("csv_mode_custom") && document.getElementById("csv_mode_custom").checked;
  const customSection = document.getElementById("csv_custom_section");
  const dummySection = document.getElementById("csv_dummy_section");
  const dummyRows = document.getElementById("csv_dummy_rows_section");
  const dummyFaker = document.getElementById("csv_dummy_faker_section");
  if (customSection) customSection.style.display = isCustom ? "block" : "none";
  if (dummySection) dummySection.style.display = isCustom ? "none" : "block";
  if (dummyRows) dummyRows.style.display = isCustom ? "none" : "block";
  if (dummyFaker) dummyFaker.style.display = isCustom ? "none" : "block";
}
document.querySelectorAll("input[name=csv_mode]").forEach(function(radio) {
  radio.addEventListener("change", toggleCsvMode);
});

document.querySelectorAll(".payload-line-tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const tabId = btn.dataset.tab;
    const isPdfTab = btn.classList.contains("payload-pdf-tab");
    document.querySelectorAll(isPdfTab ? ".payload-pdf-tab" : ".payload-line-tab-btn:not(.payload-pdf-tab)").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(isPdfTab ? ".payload-pdf-panel" : ".payload-line-tab:not(.payload-pdf-panel)").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    const panel = document.getElementById("payload_tab_" + tabId);
    if (panel) panel.classList.add("active");
    if (tabId === "preview") schedulePayloadPreview();
  });
});

var payloadPreviewTimeout;
var PAYLOAD_COLOR_NAMES = { black: "#000000", white: "#ffffff", red: "#ff0000", green: "#008000", blue: "#0000ff", pink: "#ffc0cb", gray: "#808080", grey: "#808080", transparent: "#000000" };
function parsePayloadColor(str) {
  if (!str || typeof str !== "string") return { r: 0, g: 0, b: 0 };
  str = str.trim();
  if (str.startsWith("#")) {
    var hex = str.slice(1);
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    if (hex.length === 6) {
      var n = parseInt(hex, 16);
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
  }
  var lower = str.toLowerCase();
  if (PAYLOAD_COLOR_NAMES[lower]) return parsePayloadColor(PAYLOAD_COLOR_NAMES[lower]);
  return { r: 0, g: 0, b: 0 };
}
function payloadColorToHex(str) {
  if (!str || !str.trim()) return null;
  var c = parsePayloadColor(str.trim());
  return "#" + [c.r, c.g, c.b].map(function(x) { var n = Math.max(0, Math.min(255, x)); return ("0" + n.toString(16)).slice(-2); }).join("");
}
function positionToXY(position, width, height, blockWidth, blockHeight, padding) {
  padding = padding || 20;
  var pos = (position || "top_left").toLowerCase().replace(/ /g, "_");
  var posV = "top", posH = "left";
  if (pos.indexOf("_") >= 0) {
    var parts = pos.split("_");
    if (["top", "center", "bottom"].indexOf(parts[0]) >= 0) posV = parts[0];
    if (parts.length > 1 && ["left", "center", "right"].indexOf(parts[1]) >= 0) posH = parts[1];
  } else if (["top", "center", "bottom"].indexOf(pos) >= 0) posV = pos;
  var startY = padding;
  if (posV === "bottom") startY = Math.max(padding, height - padding - blockHeight);
  else if (posV === "center") startY = Math.max(0, (height - blockHeight) / 2);
  var startX = padding;
  if (posH === "right") startX = Math.max(padding, width - padding - blockWidth);
  else if (posH === "center") startX = Math.max(0, (width - blockWidth) / 2);
  return { x: Math.round(startX), y: Math.round(startY) };
}
function getImagePreviewState() {
  var w = parseInt(document.getElementById("payload_image_width").value, 10) || 400;
  var h = parseInt(document.getElementById("payload_image_height").value, 10) || 200;
  w = Math.max(100, Math.min(2000, w));
  h = Math.max(50, Math.min(2000, h));
  var bgColor = parsePayloadColor((document.getElementById("payload_bg_color") && document.getElementById("payload_bg_color").value) || "#ffffff");
  var bgAlpha = parseInt(document.getElementById("payload_bg_alpha").value, 10);
  if (isNaN(bgAlpha)) bgAlpha = 100;
  bgAlpha = Math.max(0, Math.min(100, bgAlpha)) / 100;
  var lines = [];
  for (var i = 1; i <= 3; i++) {
    var textEl = document.getElementById("line" + i + "_text");
    var text = (textEl && textEl.value) ? textEl.value.trim().substring(0, 80) : "";
    if (!text) continue;
    var fs = parseInt(document.getElementById("line" + i + "_font_size").value, 10) || 14;
    fs = Math.max(8, Math.min(120, fs));
    var colorEl = document.getElementById("line" + i + "_color");
    var color = parsePayloadColor((colorEl && colorEl.value) ? colorEl.value : "#000000");
    var alphaEl = document.getElementById("line" + i + "_alpha");
    var alpha = parseInt(alphaEl && alphaEl.value ? alphaEl.value : 100, 10);
    if (isNaN(alpha)) alpha = 100;
    alpha = Math.max(0, Math.min(100, alpha)) / 100;
    var posEl = document.getElementById("line" + i + "_position");
    var position = (posEl && posEl.value) ? posEl.value : "top_left";
    var lowContrastEl = document.getElementById("line" + i + "_low_contrast");
    var lowContrast = lowContrastEl ? lowContrastEl.checked : false;
    var rotEl = document.getElementById("line" + i + "_text_rotation");
    var textRotation = (rotEl && rotEl.value !== "") ? parseFloat(rotEl.value) : 0;
    if (isNaN(textRotation)) textRotation = 0;
    lines.push({ text: text, fontSize: fs, color: color, alpha: alpha, position: position, lowContrast: lowContrast, textRotation: textRotation });
  }
  var fileInput = document.getElementById("payload_image_file");
  var file = (fileInput && fileInput.files && fileInput.files[0]) ? fileInput.files[0] : null;
  return { width: w, height: h, bgColor: bgColor, bgAlpha: bgAlpha, lines: lines, file: file };
}
function drawPayloadPreview() {
  var canvas = document.getElementById("payload_preview_canvas");
  if (!canvas) return;
  var state = getImagePreviewState();
  var w = state.width, h = state.height;
  canvas.width = w;
  canvas.height = h;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;
  function drawBackground() {
    ctx.fillStyle = "rgba(" + state.bgColor.r + "," + state.bgColor.g + "," + state.bgColor.b + "," + state.bgAlpha + ")";
    ctx.fillRect(0, 0, w, h);
  }
  function drawLines() {
    var padding = 20;
    state.lines.forEach(function(line) {
      var fontSize = Math.max(8, Math.min(120, line.fontSize));
      ctx.font = fontSize + "px sans-serif";
      var metrics = ctx.measureText(line.text);
      var blockWidth = Math.min(metrics.width, w - 2 * padding);
      var blockHeight = fontSize + 6;
      var pos = positionToXY(line.position, w, h, blockWidth, blockHeight, padding);
      var r = line.color.r, g = line.color.g, b = line.color.b;
      if (line.lowContrast) { r = 180; g = 180; b = 180; }
      ctx.fillStyle = "rgba(" + r + "," + g + "," + b + "," + line.alpha + ")";
      var rot = (line.textRotation != null && !isNaN(line.textRotation)) ? line.textRotation : 0;
      if (Math.abs(rot) >= 0.5) {
        ctx.save();
        var cx = pos.x + blockWidth / 2, cy = pos.y + fontSize / 2;
        ctx.translate(cx, cy);
        ctx.rotate(-rot * Math.PI / 180);
        ctx.translate(-cx, -cy);
        ctx.fillText(line.text, pos.x, pos.y + fontSize);
        ctx.restore();
      } else {
        ctx.fillText(line.text, pos.x, pos.y + fontSize);
      }
    });
  }
  if (state.file) {
    var url = URL.createObjectURL(state.file);
    var img = new Image();
    img.onload = function() {
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      drawLines();
    };
    img.onerror = function() {
      URL.revokeObjectURL(url);
      drawBackground();
      drawLines();
    };
    img.src = url;
  } else {
    drawBackground();
    drawLines();
  }
}
function schedulePayloadPreview() {
  clearTimeout(payloadPreviewTimeout);
  payloadPreviewTimeout = setTimeout(drawPayloadPreview, 120);
}
var payloadImagePreviewInputs = ["line1_text", "line1_font_size", "line1_color", "line1_alpha", "line1_position", "line1_low_contrast", "line1_text_rotation", "line2_text", "line2_font_size", "line2_color", "line2_alpha", "line2_position", "line2_low_contrast", "line2_text_rotation", "line3_text", "line3_font_size", "line3_color", "line3_alpha", "line3_position", "line3_low_contrast", "line3_text_rotation", "payload_image_width", "payload_image_height", "payload_bg_color", "payload_bg_alpha"];
payloadImagePreviewInputs.forEach(function(id) {
  var el = document.getElementById(id);
  if (el) {
    el.addEventListener("input", schedulePayloadPreview);
    el.addEventListener("change", schedulePayloadPreview);
  }
});
[1, 2, 3].forEach(function(i) {
  var picker = document.getElementById("line" + i + "_color_picker");
  var textEl = document.getElementById("line" + i + "_color");
  if (picker && textEl) {
    var hex = payloadColorToHex(textEl.value);
    if (hex) picker.value = hex;
    picker.addEventListener("input", function() {
      textEl.value = picker.value;
      schedulePayloadPreview();
    });
    picker.addEventListener("change", function() {
      textEl.value = picker.value;
      schedulePayloadPreview();
    });
    textEl.addEventListener("input", function() {
      var h = payloadColorToHex(textEl.value);
      if (h) picker.value = h;
    });
    textEl.addEventListener("change", function() {
      var h = payloadColorToHex(textEl.value);
      if (h) picker.value = h;
    });
  }
});
[1, 2, 3].forEach(function(i) {
  var picker = document.getElementById("pdf_line" + i + "_color_picker");
  var textEl = document.getElementById("pdf_line" + i + "_color");
  if (picker && textEl) {
    var hex = payloadColorToHex(textEl.value);
    if (hex) picker.value = hex;
    picker.addEventListener("input", function() {
      textEl.value = picker.value;
    });
    picker.addEventListener("change", function() {
      textEl.value = picker.value;
    });
    textEl.addEventListener("input", function() {
      var h = payloadColorToHex(textEl.value);
      if (h) picker.value = h;
    });
    textEl.addEventListener("change", function() {
      var h = payloadColorToHex(textEl.value);
      if (h) picker.value = h;
    });
  }
});
var payloadImageFileEl = document.getElementById("payload_image_file");
if (payloadImageFileEl) {
  payloadImageFileEl.addEventListener("change", function() {
    schedulePayloadPreview();
    if (document.getElementById("payload_tab_preview").classList.contains("active")) drawPayloadPreview();
  });
}
document.getElementById("main_menu").addEventListener("click", function(e) {
  var li = e.target.closest("li[data-panel]");
  if (li && li.dataset.panel === "payloads") setTimeout(schedulePayloadPreview, 50);
});

async function loadPayloadsList() {
  try {
    const r = await fetch(API + "/payloads/list", { credentials: "include" });
    const data = await r.json().catch(() => ({}));
    const files = data.files || [];
    const table = document.getElementById("payload_list_table");
    const tbody = table.querySelector("tbody");
    const emptyEl = document.getElementById("payload_list_empty");
    tbody.innerHTML = "";
    if (files.length === 0) {
      table.style.display = "none";
      emptyEl.style.display = "block";
      return;
    }
    emptyEl.style.display = "none";
    table.style.display = "table";
    files.forEach(f => {
      const tr = document.createElement("tr");
      const rel = f.relative_path || f.name;
      const downloadUrl = API + "/payloads/file/" + encodeURIComponent(rel);
      tr.innerHTML = "<td>" + escapeHtml(f.name) + "</td><td><code>" + escapeHtml(rel) + "</code></td><td>" + (f.size != null ? f.size + " B" : "") + "</td><td><a href=\"" + escapeHtml(downloadUrl) + "\" target=\"_blank\" rel=\"noopener\">Download</a></td>";
      tbody.appendChild(tr);
    });
  } catch (err) {
    document.getElementById("payload_list_empty").textContent = "Could not load list: " + (err.message || "error");
    document.getElementById("payload_list_empty").style.display = "block";
    document.getElementById("payload_list_table").style.display = "none";
  }
}
function escapeHtml(s) {
  if (s == null) return "";
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

document.getElementById("btn_payload_generate").addEventListener("click", async () => {
  const statusEl = document.getElementById("payload_generate_status");
  const resultEl = document.getElementById("payload_generated_result");
  const assetType = document.getElementById("payload_asset_type").value;
  statusEl.style.display = "none";
  resultEl.style.display = "none";
  const body = { asset_type: assetType };
  if (assetType === "text") {
    body.content = document.getElementById("payload_content").value;
    body.filename = document.getElementById("payload_filename").value.trim() || undefined;
  }
  if (assetType === "pdf") {
    for (var i = 1; i <= 3; i++) {
      body["pdf_line" + i + "_text"] = document.getElementById("pdf_line" + i + "_text").value.trim();
      body["pdf_line" + i + "_font_size"] = parseInt(document.getElementById("pdf_line" + i + "_font_size").value, 10) || 12;
      body["pdf_line" + i + "_color"] = document.getElementById("pdf_line" + i + "_color").value.trim();
      var lineAlpha = parseInt(document.getElementById("pdf_line" + i + "_alpha").value, 10);
      body["pdf_line" + i + "_alpha"] = Math.min(255, Math.max(0, Math.round((lineAlpha != null && !isNaN(lineAlpha) ? lineAlpha : 100) * 2.55)));
      body["pdf_line" + i + "_position"] = document.getElementById("pdf_line" + i + "_position").value || "top_left";
    }
    body.pdf_hidden_content = document.getElementById("pdf_hidden_content").value.trim() || "";
    body.pdf_filename = document.getElementById("payload_pdf_filename").value.trim() || undefined;
  }
  if (assetType === "image") {
    for (var i = 1; i <= 3; i++) {
      body["line" + i + "_text"] = document.getElementById("line" + i + "_text").value.trim();
      body["line" + i + "_font_size"] = parseInt(document.getElementById("line" + i + "_font_size").value, 10) || 14;
      body["line" + i + "_color"] = document.getElementById("line" + i + "_color").value.trim();
      var lineAlpha = parseInt(document.getElementById("line" + i + "_alpha").value, 10);
      body["line" + i + "_alpha"] = Math.min(255, Math.max(0, Math.round((lineAlpha != null && !isNaN(lineAlpha) ? lineAlpha : 100) * 2.55)));
      body["line" + i + "_position"] = document.getElementById("line" + i + "_position").value || "top_left";
      body["line" + i + "_low_contrast"] = document.getElementById("line" + i + "_low_contrast").checked;
      body["line" + i + "_text_rotation"] = parseFloat(document.getElementById("line" + i + "_text_rotation").value) || 0;
      body["line" + i + "_blur_radius"] = parseFloat(document.getElementById("line" + i + "_blur_radius").value) || 0;
      body["line" + i + "_noise_level"] = parseFloat(document.getElementById("line" + i + "_noise_level").value) || 0;
    }
    body.position = "top_left";
    body.font_size = 14;
    body.filename = document.getElementById("payload_image_filename").value.trim() || undefined;
    body.width = parseInt(document.getElementById("payload_image_width").value, 10) || 400;
    body.height = parseInt(document.getElementById("payload_image_height").value, 10) || 200;
    body.background_color = document.getElementById("payload_bg_color").value.trim() || undefined;
    var bgAlpha = parseInt(document.getElementById("payload_bg_alpha").value, 10);
    body.background_alpha = Math.min(255, Math.max(0, Math.round((bgAlpha != null && !isNaN(bgAlpha) ? bgAlpha : 100) * 2.55)));
  }
  if (assetType === "pdf_metadata") {
    body.body_content = document.getElementById("payload_body_content").value;
    body.subject = document.getElementById("payload_subject").value.trim();
    body.author = document.getElementById("payload_author").value.trim();
    body.filename = document.getElementById("payload_filename_pdf_meta").value.trim() || undefined;
  }
  if (assetType === "csv") {
    var csvCustom = document.getElementById("csv_mode_custom") && document.getElementById("csv_mode_custom").checked;
    body.filename = document.getElementById("payload_csv_filename").value.trim() || undefined;
    if (csvCustom) {
      body.csv_content = document.getElementById("payload_csv_content").value;
    } else {
      body.csv_columns = document.getElementById("payload_csv_columns").value.trim();
      body.csv_num_rows = parseInt(document.getElementById("payload_csv_num_rows").value, 10) || 10;
      body.csv_use_faker = document.getElementById("payload_csv_use_faker").checked;
    }
  }
  if (assetType === "qr") {
    body.payload = document.getElementById("payload_qr_payload").value.trim();
    body.filename = document.getElementById("payload_filename_qr").value.trim() || undefined;
  }
  if (assetType === "audio_synthetic") {
    body.duration_sec = parseFloat(document.getElementById("payload_duration").value) || 1;
    body.frequency = parseFloat(document.getElementById("payload_frequency").value) || 440;
    body.filename = document.getElementById("payload_filename_audio").value.trim() || undefined;
  }
  if (assetType === "audio_tts") {
    body.text = document.getElementById("payload_tts_text").value;
    body.filename = document.getElementById("payload_filename_tts").value.trim() || undefined;
  }
  document.getElementById("btn_payload_generate").disabled = true;
  try {
    const imageFileInput = document.getElementById("payload_image_file");
    const pdfFileInput = document.getElementById("payload_pdf_file");
    const pdfMetadataFileInput = document.getElementById("payload_pdf_metadata_file");
    const useMultipartImage = assetType === "image" && imageFileInput && imageFileInput.files && imageFileInput.files.length > 0;
    const useMultipartPdf = assetType === "pdf" && pdfFileInput && pdfFileInput.files && pdfFileInput.files.length > 0;
    const useMultipartPdfMetadata = assetType === "pdf_metadata" && pdfMetadataFileInput && pdfMetadataFileInput.files && pdfMetadataFileInput.files.length > 0;
    let fetchOpts = { method: "POST", credentials: "include" };
    if (useMultipartImage) {
      const form = new FormData();
      form.append("asset_type", assetType);
      for (var i = 1; i <= 3; i++) {
        if (body["line" + i + "_text"]) {
          form.append("line" + i + "_text", body["line" + i + "_text"]);
          form.append("line" + i + "_font_size", String(body["line" + i + "_font_size"] != null ? body["line" + i + "_font_size"] : 14));
          if (body["line" + i + "_color"]) form.append("line" + i + "_color", body["line" + i + "_color"]);
          form.append("line" + i + "_alpha", String(body["line" + i + "_alpha"] != null ? body["line" + i + "_alpha"] : 255));
          form.append("line" + i + "_position", body["line" + i + "_position"] || "top_left");
          form.append("line" + i + "_low_contrast", body["line" + i + "_low_contrast"] ? "true" : "false");
          form.append("line" + i + "_text_rotation", String(body["line" + i + "_text_rotation"] != null ? body["line" + i + "_text_rotation"] : 0));
          form.append("line" + i + "_blur_radius", String(body["line" + i + "_blur_radius"] != null ? body["line" + i + "_blur_radius"] : 0));
          form.append("line" + i + "_noise_level", String(body["line" + i + "_noise_level"] != null ? body["line" + i + "_noise_level"] : 0));
        }
      }
      form.append("position", body.position || "top_left");
      form.append("font_size", String(body.font_size != null ? body.font_size : 14));
      if (body.filename) form.append("filename", body.filename);
      form.append("width", String(body.width || 400));
      form.append("height", String(body.height || 200));
      if (body.background_color) form.append("background_color", body.background_color);
      form.append("background_alpha", String(body.background_alpha != null ? body.background_alpha : 255));
      form.append("file", imageFileInput.files[0]);
      fetchOpts.body = form;
    } else if (useMultipartPdf) {
      const form = new FormData();
      form.append("asset_type", assetType);
      for (var i = 1; i <= 3; i++) {
        form.append("pdf_line" + i + "_text", body["pdf_line" + i + "_text"] || "");
        form.append("pdf_line" + i + "_font_size", String(body["pdf_line" + i + "_font_size"] != null ? body["pdf_line" + i + "_font_size"] : 12));
        if (body["pdf_line" + i + "_color"]) form.append("pdf_line" + i + "_color", body["pdf_line" + i + "_color"]);
        form.append("pdf_line" + i + "_alpha", String(body["pdf_line" + i + "_alpha"] != null ? body["pdf_line" + i + "_alpha"] : 255));
        form.append("pdf_line" + i + "_position", body["pdf_line" + i + "_position"] || "top_left");
      }
      form.append("pdf_hidden_content", body.pdf_hidden_content || "");
      if (body.pdf_filename) form.append("pdf_filename", body.pdf_filename);
      var pdfFile = pdfFileInput.files[0];
      form.append("payload_pdf_file", pdfFile, pdfFile.name || "document.pdf");
      fetchOpts.body = form;
    } else if (useMultipartPdfMetadata) {
      const form = new FormData();
      form.append("asset_type", assetType);
      form.append("body_content", body.body_content || "Document body.");
      form.append("subject", body.subject || "");
      form.append("author", body.author || "");
      if (body.filename) form.append("filename", body.filename);
      var metaFile = pdfMetadataFileInput.files[0];
      form.append("payload_pdf_metadata_file", metaFile, metaFile.name || "document.pdf");
      fetchOpts.body = form;
    } else {
      fetchOpts.headers = { "Content-Type": "application/json" };
      fetchOpts.body = JSON.stringify(body);
    }
    const r = await fetch(API + "/payloads/generate", fetchOpts);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      statusEl.textContent = data.error || r.statusText || "Generation failed";
      statusEl.style.display = "block";
      statusEl.className = "message error";
      return;
    }
    const rel = data.relative_path || data.path || "";
    const downloadUrl = rel ? (API + "/payloads/file/" + encodeURIComponent(rel)) : "";
    document.getElementById("payload_download_link").href = downloadUrl;
    document.getElementById("payload_download_link").textContent = data.path || rel || "file";
    document.getElementById("payload_relative_path").textContent = rel;
    resultEl.style.display = "block";
    statusEl.textContent = "Generated successfully.";
    statusEl.className = "message";
    statusEl.style.display = "block";
    loadPayloadsList();
  } catch (err) {
    statusEl.textContent = err.message || "Network error";
    statusEl.className = "message error";
    statusEl.style.display = "block";
  } finally {
    document.getElementById("btn_payload_generate").disabled = false;
  }
});

async function loadModelDefault() {
  // Model is fixed to DEFAULT_MODEL (Claude); no in-UI selection.
}

(async function init() {
  const session = await getSession();
  updateSessionUI(session);
  if (!document.querySelector("#main_body .panel.active")) showPanel("direct");
  loadDocuments();
  loadModelDefault();
})();
