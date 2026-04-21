const API = "/api";

async function getSession() {
  const r = await fetch(API + "/session", { credentials: "include" });
  return r.json();
}

function setOutput(elId, text, kind) {
  const el = document.getElementById(elId);
  el.textContent = text || "";
  el.className = "output-box " + (kind || "empty");
}

function setLoading(elId, btnId, loading) {
  const btn = document.getElementById(btnId);
  const out = document.getElementById(elId);
  if (btn) btn.disabled = loading;
  if (loading && out) {
    out.textContent = "Waiting for response…";
    out.className = "output-box loading";
  }
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
    btnLogin.style.display = "none";
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
    btnLogin.style.display = "inline-block";
    document.getElementById("panel_login").classList.remove("active");
    document.getElementById("panel_mfa").classList.remove("active");
  }
}

document.getElementById("main_menu").addEventListener("click", (e) => {
  const li = e.target.closest("li[data-panel]");
  if (li) {
    e.preventDefault();
    showPanel(li.dataset.panel);
    if (li.dataset.panel === "experiments" && experimentsData.cases.length === 0) loadExperimentsList();
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

document.getElementById("send_direct").addEventListener("click", async () => {
  const prompt = document.getElementById("prompt_direct").value.trim();
  if (!prompt) return;
  setLoading("output_direct", "send_direct", true);
  try {
    const r = await fetch(API + "/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ prompt }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      setOutput("output_direct", data.error || r.statusText, "error");
      appendTerminalLine("Direct chat (error)", "fail");
      appendTerminalJson(data);
      return;
    }
    setOutput("output_direct", data.response ?? "", "");
    appendTerminalLine("Direct chat response", "muted");
    appendTerminalJson(data);
  } catch (err) {
    setOutput("output_direct", err.message || "Network error", "error");
    appendTerminalLine("Direct chat: " + (err.message || "Network error"), "fail");
  } finally {
    setLoading("output_direct", "send_direct", false);
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
    setOutput("output_web", data.response ?? "", "");
    appendTerminalLine("Web chat response", "muted");
    appendTerminalJson(data);
  } catch (err) {
    setOutput("output_web", err.message || "Network error", "error");
    appendTerminalLine("Web chat: " + (err.message || "Network error"), "fail");
  } finally {
    setLoading("output_web", "send_web", false);
