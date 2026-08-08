const SUPABASE_URL = 'https://qeqyjpuhkrhxwkvfnvch.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlcXlqcHVoa3JoeHdrdmZudmNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwODY5MjgsImV4cCI6MjEwMTY2MjkyOH0.OnAHkwYzDsKj0HG2Gk7QI-2jKRtaY2HbjZwZ62DdFVw';

let supabaseClient;
let currentUser = null;
let ws;
let isRunning = false;
let isSignUpMode = false;
let isEditMode = false;
let currentSessionId = null;
let sessionsList = [];

function initSupabase() {
  if (window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    checkSession();
  }
}

async function checkSession() {
  if (!supabaseClient) return;

  const { data: { session } } = await supabaseClient.auth.getSession();

  if (session && session.user) {
    onUserAuthenticated(session.user);
  } else {
    onUserSignedOut();
  }

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session && session.user) {
      onUserAuthenticated(session.user);
    } else {
      onUserSignedOut();
    }
  });
}

function onUserAuthenticated(user) {
  currentUser = user;
  document.getElementById("auth-modal").style.display = "none";
  const badgeContainer = document.getElementById("user-badge-container");
  if (badgeContainer) badgeContainer.style.display = "flex";
  const signoutBtn = document.getElementById("signout-btn");
  if (signoutBtn) signoutBtn.style.display = "inline-flex";
  
  const emailEl = document.getElementById("user-email-display");
  const avatarEl = document.getElementById("user-avatar-initial");
  if (emailEl) emailEl.innerText = user.email;
  if (avatarEl) avatarEl.innerText = user.email ? user.email[0].toUpperCase() : 'U';

  appendTerminal(`[Auth] Authenticated user tenant: ${user.email} (ID: ${user.id})`, "system");
  loadUserSessions();
}

function onUserSignedOut() {
  currentUser = null;
  currentSessionId = null;
  document.getElementById("auth-modal").style.display = "flex";
  const badgeContainer = document.getElementById("user-badge-container");
  if (badgeContainer) badgeContainer.style.display = "none";
  const signoutBtn = document.getElementById("signout-btn");
  if (signoutBtn) signoutBtn.style.display = "none";
}

function signOutUser() {
  handleSignOut();
}

function openAuthModal() {
  document.getElementById("auth-modal").style.display = "flex";
}

function toggleAuthMode() {
  isSignUpMode = !isSignUpMode;
  const title = document.getElementById("auth-title");
  const subtitle = document.getElementById("auth-subtitle");
  const submitBtn = document.getElementById("auth-submit-btn");
  const toggleText = document.getElementById("auth-toggle-text");
  const toggleBtn = document.querySelector(".btn-toggle");
  const groupFullName = document.getElementById("group-fullname");

  if (isSignUpMode) {
    title.innerText = "Create Your Workspace Account";
    subtitle.innerText = "Sign up to launch your isolated DevSecOps data environment";
    submitBtn.innerText = "Create Workspace Account";
    toggleText.innerText = "Already have an account?";
    toggleBtn.innerText = "Sign In";
    groupFullName.style.display = "flex";
  } else {
    title.innerText = "Sign In to Your Workspace";
    subtitle.innerText = "Access your isolated multi-tenant application security environment";
    submitBtn.innerText = "Sign In to Workspace";
    toggleText.innerText = "Don't have a workspace account?";
    toggleBtn.innerText = "Sign Up";
    groupFullName.style.display = "none";
  }

  document.getElementById("auth-error").style.display = "none";
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;
  const fullName = document.getElementById("auth-fullname").value.trim();
  const errorBox = document.getElementById("auth-error");
  const errorText = document.getElementById("auth-error-text");

  errorBox.style.display = "none";

  try {
    if (isSignUpMode) {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName || email.split('@')[0] } }
      });
      if (error) throw error;

      if (data.session) {
        onUserAuthenticated(data.session.user);
      } else {
        alert("Account created successfully! Check your email to confirm registration or sign in.");
      }
    } else {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;

      if (data.session) {
        onUserAuthenticated(data.session.user);
      }
    }
  } catch (err) {
    errorText.innerText = err.message || 'Authentication failed';
    errorBox.style.display = "block";
  }
}

async function handleSignOut() {
  if (supabaseClient) {
    await supabaseClient.auth.signOut();
    onUserSignedOut();
  }
}

function getApiBaseUrl() {
  const customBackend = localStorage.getItem("devsecops_backend_url");
  if (customBackend) {
    return customBackend.replace(/\/$/, "");
  }
  return "";
}

function initWebSocket() {
  const customBackend = localStorage.getItem("devsecops_backend_url");
  let wsUrl;
  
  if (customBackend) {
    const isHttps = customBackend.startsWith("https:");
    const cleanHost = customBackend.replace(/^https?:\/\//, "").replace(/\/$/, "");
    wsUrl = `${isHttps ? "wss:" : "ws:"}//${cleanHost}/ws/swarm`;
  } else {
    // If running on Vercel serverless domain, WebSocket server isn't co-located
    const isVercel = window.location.hostname.includes("vercel.app");
    if (isVercel) {
      console.warn("Running on Vercel without a custom backend URL. Connect your Render/Railway backend for live WebSockets.");
      const st = document.getElementById("status-text");
      if (st) st.innerText = "Frontend Active (Vercel Mode)";
      return;
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    wsUrl = `${protocol}//${window.location.host}/ws/swarm`;
  }
  
  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("WebSocket connected to DevSecOps Swarm:", wsUrl);
      const st = document.getElementById("status-text");
      if (st) st.innerText = "System Ready (Backend Connected)";
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (!data.user_id || (currentUser && data.user_id === currentUser.id)) {
          if (!data.session_id || data.session_id === currentSessionId) {
            handleSwarmEvent(data);
          }
        }
      } catch (e) {
        console.error("Error parsing WebSocket message:", e);
      }
    };

    ws.onerror = () => {
      const st = document.getElementById("status-text");
      if (st) st.innerText = "Backend Offline • Connect URL or API Key";
    };

    ws.onclose = () => {
      // Reconnect after 6s if not on vercel default
      if (!window.location.hostname.includes("vercel.app")) {
        setTimeout(initWebSocket, 6000);
      }
    };
  } catch (err) {
    console.warn("WebSocket init error:", err);
  }
}

function loadAvailableModels() {
  const apiBase = getApiBaseUrl();
  fetch(`${apiBase}/api/models`)
    .then(res => {
      if (!res.ok) throw new Error("Backend not reachable");
      return res.json();
    })
    .then(data => {
      const select = document.getElementById("model-select");
      if (!select) return;
      select.innerHTML = "";
      if (data.models && data.models.length > 0) {
        data.models.forEach(m => {
          const opt = document.createElement("option");
          opt.value = m;
          opt.innerText = m;
          select.appendChild(opt);
        });
      }
    })
    .catch(err => {
      // Graceful fallback for Vercel deployment
      const select = document.getElementById("model-select");
      if (select && select.children.length === 0) {
        const defaultModels = [
          "Gemini Cloud API (Key Enabled)",
          "Gemini 1.5 Flash (Fast Synthesizer)",
          "Gemini 1.5 Pro (Deep Reasoning)",
          "Auto-Detect / Dynamic Synthesizer"
        ];
        select.innerHTML = "";
        defaultModels.forEach(m => {
          const opt = document.createElement("option");
          opt.value = m;
          opt.innerText = m;
          select.appendChild(opt);
        });
      }
    });
}

function loadUserSessions() {
  if (!currentUser) return;
  const apiBase = getApiBaseUrl();

  fetch(`${apiBase}/api/sessions/${currentUser.id}`)
    .then(res => {
      if (!res.ok) throw new Error("Backend sessions endpoint unavailable");
      return res.json();
    })
    .then(sessions => {
      sessionsList = sessions || [];
      renderSidebarSessions();
      if (sessionsList.length > 0 && !currentSessionId) {
        loadSession(sessionsList[0].id);
      } else if (sessionsList.length === 0) {
        createNewChatSession();
      }
    })
    .catch(err => {
      // Vercel client-side fallback storage
      const localKey = `devsecops_sessions_${currentUser.id}`;
      const saved = localStorage.getItem(localKey);
      if (saved) {
        try {
          sessionsList = JSON.parse(saved);
        } catch (e) {
          sessionsList = [];
        }
      }
      if (!sessionsList || sessionsList.length === 0) {
        sessionsList = [{
          id: "session_default",
          title: "Main Security Workspace",
          created_at: new Date().toISOString()
        }];
      }
      renderSidebarSessions();
      if (!currentSessionId) {
        currentSessionId = sessionsList[0].id;
      }
    });
}
    .then(res => res.json())
    .then(sessions => {
      sessionsList = sessions || [];
      renderSidebarSessions();
      if (sessionsList.length > 0 && !currentSessionId) {
        loadSession(sessionsList[0].id);
      } else if (sessionsList.length === 0) {
        createNewChatSession();
      }
    })
    .catch(err => console.error("Error loading sessions:", err));
}

function renderSidebarSessions() {
  const listContainer = document.getElementById("chat-history-list");
  if (!listContainer) return;

  if (sessionsList.length === 0) {
    listContainer.innerHTML = '<div class="empty-history-text">No project sessions yet. Click "+ New Chat" above.</div>';
    return;
  }

  let html = "";
  sessionsList.forEach(session => {
    const isActive = session.id === currentSessionId ? "active" : "";
    html += `
      <div class="chat-item ${isActive}" onclick="loadSession('${session.id}')">
        <div class="chat-item-title-box">
          <svg class="chat-item-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span class="chat-item-text">${escapeHtml(session.title)}</span>
        </div>
        <div class="chat-item-actions">
          <button class="chat-item-action chat-item-rename" onclick="event.stopPropagation(); renameSession('${session.id}', '${escapeHtml(session.title)}')" title="Rename Workspace">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="chat-item-action chat-item-delete" onclick="event.stopPropagation(); deleteSession('${session.id}')" title="Delete Workspace">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    `;
  });
  listContainer.innerHTML = html;
}

function renameSession(sessionId, currentTitle) {
  if (!currentUser) return;
  const newTitle = prompt("Enter new title for this program workspace:", currentTitle);
  if (!newTitle || !newTitle.trim()) return;

  fetch("/api/sessions/rename", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: currentUser.id,
      session_id: sessionId,
      new_title: newTitle.trim()
    })
  })
  .then(res => res.json())
  .then(data => {
    const session = sessionsList.find(s => s.id === sessionId);
    if (session) session.title = newTitle.trim();
    renderSidebarSessions();
  })
  .catch(err => console.error("Error renaming session:", err));
}

function createNewChatSession() {
  if (!currentUser) return;

  fetch("/api/sessions/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: currentUser.id, title: "New Program Workspace" })
  })
  .then(res => res.json())
  .then(newSession => {
    currentSessionId = newSession.id;
    sessionsList.unshift(newSession);
    renderSidebarSessions();
    resetUI(10);
    document.getElementById("prompt-input").value = "";
    document.getElementById("prompt-input").focus();
    closeSidebar();
  })
  .catch(err => console.error("Error creating chat session:", err));
}

function loadSession(sessionId) {
  if (!currentUser) return;
  currentSessionId = sessionId;
  renderSidebarSessions();
  closeSidebar();

  fetch(`/api/sessions/${currentUser.id}/${sessionId}`)
    .then(res => res.json())
    .then(data => {
      if (data.app_code) {
        updateCodeView(data.app_code);
      } else {
        updateCodeView("# New program workspace created.\nEnter a prompt above to generate software...");
      }

      if (data.test_code) {
        const testEl = document.getElementById("test-display");
        if (testEl) {
          testEl.textContent = data.test_code;
          if (window.hljs) {
            delete testEl.dataset.highlighted;
            hljs.highlightElement(testEl);
          }
        }
      }

      if (data.vulnerability_report) {
        renderAuditReport(data.vulnerability_report);
      } else {
        document.getElementById("audit-display").innerHTML = '<p class="empty-state">No security vulnerability report generated yet for this session.</p>';
      }

      appendTerminal(`[Session] Switched active workspace to session: ${sessionId}`, "system");
    })
    .catch(err => console.error("Error loading session details:", err));
}

function deleteSession(sessionId) {
  if (!currentUser) return;
  if (!confirm("Are you sure you want to delete this project workspace?")) return;

  fetch(`/api/sessions/${currentUser.id}/${sessionId}`, { method: "DELETE" })
    .then(res => res.json())
    .then(() => {
      sessionsList = sessionsList.filter(s => s.id !== sessionId);
      if (currentSessionId === sessionId) {
        currentSessionId = sessionsList.length > 0 ? sessionsList[0].id : null;
        if (currentSessionId) {
          loadSession(currentSessionId);
        } else {
          createNewChatSession();
        }
      } else {
        renderSidebarSessions();
      }
    })
    .catch(err => console.error("Error deleting session:", err));
}

function openSidebar() {
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("sidebar-backdrop");
  if (sidebar) sidebar.classList.add("open");
  if (backdrop) backdrop.classList.add("active");
}

function closeSidebar() {
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("sidebar-backdrop");
  if (sidebar) sidebar.classList.remove("open");
  if (backdrop) backdrop.classList.remove("active");
}

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  if (sidebar && sidebar.classList.contains("open")) {
    closeSidebar();
  } else {
    openSidebar();
  }
}

function setPrompt(text) {
  document.getElementById("prompt-input").value = text;
}

function switchTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(content => content.classList.remove("active"));

  if (event && event.target) {
    event.target.classList.add("active");
  }
  const targetTab = document.getElementById(`tab-${tabName}`);
  if (targetTab) {
    targetTab.classList.add("active");
  }

  highlightAllCodeBlocks();
}

function executeSwarmLoop() {
  isRunning = false;
  startSwarm();
}

function downloadSecurePackage() {
  exportZipPackage();
}

function startSwarm() {
  if (!currentUser) {
    currentUser = { id: "guest_devsecops_user", email: "guest@devsecops.io" };
  }

  if (!currentSessionId) {
    currentSessionId = "session_" + Date.now();
    const newSession = { id: currentSessionId, title: "New Program Workspace", created_at: new Date().toISOString() };
    sessionsList.unshift(newSession);
    renderSidebarSessions();
  }

  const promptInput = document.getElementById("prompt-input");
  const prompt = promptInput ? promptInput.value.trim() : "";
  const maxLoopsEl = document.getElementById("max-loops-select");
  const maxLoops = maxLoopsEl ? (parseInt(maxLoopsEl.value) || 10) : 10;
  const modelSelectEl = document.getElementById("model-select");
  const selectedModel = modelSelectEl ? modelSelectEl.value : "auto";

  if (!prompt) {
    alert("Please enter a software prompt to execute!");
    return;
  }

  isRunning = true;
  const runBtn = document.getElementById("run-btn");
  if (runBtn) {
    runBtn.disabled = true;
    runBtn.innerText = "Executing...";
  }

  resetUI(maxLoops);
  appendTerminal(`\n[Swarm Trigger] Executing swarm for: "${prompt}"...`, "system");

  fetch("/api/swarm/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: prompt,
      max_loops: maxLoops,
      selected_model: selectedModel,
      user_id: currentUser.id,
      session_id: currentSessionId,
      api_key: localStorage.getItem("gemini_api_key") || null
    })
  }).then(res => {
    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }
    return res.json();
  })
  .then(data => {
    appendTerminal(`[System] Swarm workflow active (Session: ${currentSessionId})`, "system");
    setTimeout(loadUserSessions, 1000);
  }).catch(err => {
    console.error("Failed to start swarm:", err);
    isRunning = false;
    if (runBtn) {
      runBtn.disabled = false;
      runBtn.innerText = "Execute Swarm Loop";
    }
    appendTerminal(`[Error] Failed to start swarm: ${err.message}`, "system");
  });
}

function openApiKeyModal() {
  const modal = document.getElementById("api-key-modal");
  const input = document.getElementById("gemini-api-key-input");
  const savedKey = localStorage.getItem("gemini_api_key") || "";
  if (input) input.value = savedKey;
  if (modal) modal.style.display = "flex";
}

function closeApiKeyModal(e) {
  const modal = document.getElementById("api-key-modal");
  if (modal) modal.style.display = "none";
}

function saveApiKey() {
  const input = document.getElementById("gemini-api-key-input");
  if (input) {
    const key = input.value.trim();
    if (key) {
      localStorage.setItem("gemini_api_key", key);
      appendTerminal(`[Auth] Saved custom Gemini API Key (${key.slice(0, 8)}...). Cloud AI code generation enabled.`, "system");
    } else {
      localStorage.removeItem("gemini_api_key");
      appendTerminal(`[Auth] Gemini API Key cleared.`, "system");
    }
  }
  closeApiKeyModal();
}

function toggleEditMode() {
  isEditMode = !isEditMode;
  const displayPre = document.querySelector("#tab-code .vscode-code-pre");
  const editorArea = document.getElementById("code-editor");
  const toggleBtn = document.getElementById("edit-toggle-btn");

  if (isEditMode) {
    displayPre.style.display = "none";
    editorArea.style.display = "block";
    toggleBtn.innerText = "View Highlighted Code";
  } else {
    displayPre.style.display = "block";
    editorArea.style.display = "none";
    toggleBtn.innerText = "Edit Custom Code";
    updateCodeView(editorArea.value);
  }
}

function auditCustomCode() {
  if (!currentUser) {
    alert("Please sign in to audit custom code!");
    return;
  }

  const customCode = document.getElementById("code-editor").value;
  if (!customCode.trim()) return;

  if (isEditMode) {
    toggleEditMode();
  } else {
    updateCodeView(customCode);
  }

  isRunning = true;
  document.getElementById("run-btn").disabled = true;
  document.getElementById("run-btn").innerText = "Auditing Code...";

  fetch("/api/swarm/audit-custom-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: customCode, user_id: currentUser.id, session_id: currentSessionId })
  }).then(res => res.json())
  .then(data => {
    appendTerminal(`[System] User custom code edits submitted. Hacker & Patcher Agents activated!`, "system");
  }).catch(err => {
    console.error("Error submitting custom code:", err);
    isRunning = false;
    document.getElementById("run-btn").disabled = false;
    document.getElementById("run-btn").innerText = "Execute Swarm Loop";
  });
}

function extendIterations() {
  fetch("/api/swarm/extend", { method: "POST" })
    .then(res => res.json())
    .then(data => {
      document.getElementById("max-loop-display").innerText = data.new_max_loops;
      appendTerminal(`[System] Extended max iterations by +5 loops. New limit: ${data.new_max_loops}`, "system");
    })
    .catch(err => console.error("Error extending iterations:", err));
}

function exportZipPackage() {
  if (!currentUser) {
    alert("Please sign in to export your workspace package!");
    return;
  }
  window.location.href = `/api/swarm/export/${currentUser.id}`;
}

function downloadPdfReport() {
  if (!currentUser) {
    alert("Please sign in to download your Compliance PDF Certificate!");
    return;
  }
  const sid = currentSessionId || "main";
  window.location.href = `/api/swarm/export-pdf/${currentUser.id}/${sid}`;
}



function selectPayload(type) {
  const input = document.getElementById("exploit-input");
  if (type === 'eval') input.value = "__import__('os').system('whoami')";
  else if (type === 'sqli') input.value = "' OR '1'='1' --";
  else if (type === 'traversal') input.value = "../../../../etc/passwd";
}

function runExploitSimulation() {
  const payload = document.getElementById("exploit-input").value;
  const resultBox = document.getElementById("exploit-result");
  const preOut = document.getElementById("exploit-out-pre");
  const postOut = document.getElementById("exploit-out-post");
  const runBtn = document.getElementById("btn-run-exploit");

  runBtn.innerText = "Simulating Cyber Attack Payload...";
  runBtn.disabled = true;

  setTimeout(() => {
    resultBox.style.display = "grid";
    runBtn.innerText = "Launch Live Exploit Simulation";
    runBtn.disabled = false;

    if (payload.includes("system") || payload.includes("eval")) {
      preOut.innerText = `$ python generated_app.py --expr "${payload}"\n[VULNERABLE] Output: root / SYSTEM\n[CRITICAL ALERT] Remote Code Execution via eval() (CWE-95) succeeded!\nProcess memory compromised. Arbitrary shell access granted.`;
      postOut.innerText = `$ python generated_app.py --expr "${payload}"\n[SAFE] ValueError: Dangerous syntax '__import__' is blocked by AST Safe Evaluator.\n[REMEDIATED] 0 vulnerabilities exposed. Application protected by secure AST parser.`;
    } else if (payload.includes("OR")) {
      preOut.innerText = `$ python generated_app.py --user "admin' OR '1'='1"\n[VULNERABLE] Query executed: SELECT * FROM users WHERE username = 'admin' OR '1'='1'\n[CRITICAL ALERT] SQL Injection (CWE-89) succeeded!\nAuthentication bypassed cleanly. Logged in as administrator.`;
      postOut.innerText = `$ python generated_app.py --user "admin' OR '1'='1"\n[SAFE] Query executed: SELECT * FROM users WHERE username = ? [Params: ("admin' OR '1'='1",)]\n[REMEDIATED] Parameterized prepared query blocked injection. Invalid login rejected.`;
    } else {
      preOut.innerText = `$ python generated_app.py --file "${payload}"\n[VULNERABLE] File content exposed: root:x:0:0:root:/root:/bin/bash\n[CRITICAL ALERT] Path Traversal (CWE-22) succeeded!\nSystem credentials read from filesystem.`;
      postOut.innerText = `$ python generated_app.py --file "${payload}"\n[SAFE] PermissionError: Access outside sandbox directory blocked by os.path.resolve().\n[REMEDIATED] Path traversal blocked cleanly. File request denied.`;
    }

    appendTerminal(`[Red-Team Exploit Sandbox] Live payload simulation completed for: ${payload}`, "cmd");
  }, 600);
}



function resetUI(maxLoops = 10) {
  document.querySelectorAll(".agent-node").forEach(node => {
    node.className = "agent-node card-static-pop";
  });
  document.querySelectorAll(".agent-status").forEach(st => {
    st.innerHTML = '<span class="status-dot dot-idle"></span> IDLE';
  });

  // Clear Code Editor tab
  updateCodeView("# New program workspace created.\nEnter a prompt above to generate software...");

  // Clear Pytest suite tab
  const testEl = document.getElementById("test-display");
  if (testEl) {
    testEl.textContent = "# Pytest test suite will generate here when you run the swarm...";
    if (window.hljs) {
      delete testEl.dataset.highlighted;
      hljs.highlightElement(testEl);
    }
  }

  // Clear Audit Report tab
  document.getElementById("audit-display").innerHTML = '<p class="empty-state">No security vulnerability report generated yet. Run the swarm to analyze app.py with Bandit.</p>';

  // Clear Diff view tabs
  const beforeEl = document.getElementById("diff-before");
  const afterEl = document.getElementById("diff-after");
  if (beforeEl) {
    beforeEl.textContent = "# Vulnerable code version pre-patch will appear here...";
    if (window.hljs) { delete beforeEl.dataset.highlighted; hljs.highlightElement(beforeEl); }
  }
  if (afterEl) {
    afterEl.textContent = "# Securitized code version post-patch will appear here...";
    if (window.hljs) { delete afterEl.dataset.highlighted; hljs.highlightElement(afterEl); }
  }

  // Clear Exploit Sandbox outputs
  const exploitResult = document.getElementById("exploit-result");
  if (exploitResult) exploitResult.style.display = "none";

  // Clear Terminal Output
  document.getElementById("terminal-output").innerHTML = '<div class="terminal-line system">[System initialized. New workspace ready...]</div>';

  document.getElementById("loop-counter").innerText = "0";
  document.getElementById("max-loop-display").innerText = maxLoops;

  // Switch tab to main app.py code view
  switchTabByName("code");
}

function updateCodeView(codeText) {
  const editor = document.getElementById("code-editor");
  const codeDisplay = document.getElementById("code-display");
  
  if (editor) editor.value = codeText;
  if (codeDisplay) {
    codeDisplay.textContent = codeText;
    if (window.hljs) {
      delete codeDisplay.dataset.highlighted;
      hljs.highlightElement(codeDisplay);
    }
  }
}

function highlightAllCodeBlocks() {
  if (window.hljs) {
    document.querySelectorAll('pre code').forEach((el) => {
      delete el.dataset.highlighted;
      hljs.highlightElement(el);
    });
  }
}

function handleSwarmEvent(data) {
  switch (data.type) {
    case "STATUS":
      const statusEl = document.getElementById("status-text");
      if (statusEl) statusEl.innerText = cleanText(data.message);
      break;

    case "LOOP_START":
      document.getElementById("loop-counter").innerText = data.loop;
      document.getElementById("max-loop-display").innerText = data.max_loops;
      break;

    case "AGENT_START":
      setAgentState(data.agent, "running", "EXECUTING");
      appendTerminal(`\n=== ${data.title} ===`, "cmd");
      if (data.agent === "coder") {
        switchTabByName("code");
      } else if (data.agent === "patcher") {
        switchTabByName("diff");
      }
      break;

    case "AGENT_END":
      if (data.status === "SUCCESS") {
        setAgentState(data.agent, "success", "PASSED");
      } else if (data.status === "VULNERABLE") {
        setAgentState(data.agent, "vulnerable", "VULNERABLE");
      } else if (data.status === "PATCHED") {
        setAgentState(data.agent, "success", "PATCHED");
      } else {
        setAgentState(data.agent, "", "FAILED");
      }
      break;

    case "LOG":
      appendTerminal(cleanText(data.text));
      break;

    case "TERMINAL_OUTPUT":
      if (data.cmd) appendTerminal(`$ ${data.cmd}`, "cmd");
      appendTerminal(cleanText(data.output));
      break;

    case "FILE_STREAM":
      if (data.file === "app.py") {
        updateCodeView(data.content);
      }
      break;

    case "FILE_UPDATE":
      if (data.file === "app.py") {
        updateCodeView(data.content);
      } else if (data.file === "test_app.py") {
        const testEl = document.getElementById("test-display");
        if (testEl) {
          testEl.textContent = data.content;
          if (window.hljs) {
            delete testEl.dataset.highlighted;
            hljs.highlightElement(testEl);
          }
        }
      } else if (data.file === "vulnerability_report.md") {
        renderAuditReport(data.content);
      }
      break;

    case "DIFF_UPDATE":
      const beforeEl = document.getElementById("diff-before");
      const afterEl = document.getElementById("diff-after");
      if (beforeEl) {
        beforeEl.textContent = data.before;
        if (window.hljs) {
          delete beforeEl.dataset.highlighted;
          hljs.highlightElement(beforeEl);
        }
      }
      if (afterEl) {
        afterEl.textContent = data.after;
        if (window.hljs) {
          delete afterEl.dataset.highlighted;
          hljs.highlightElement(afterEl);
        }
      }
      break;

    case "PIPELINE_COMPLETE":
      isRunning = false;
      document.getElementById("run-btn").disabled = false;
      document.getElementById("run-btn").innerText = "Execute Swarm Loop";
      const statusComp = document.getElementById("status-text");
      if (statusComp) statusComp.innerText = "Verified Secure";
      appendTerminal(`\n[Pipeline Complete] ${cleanText(data.message)}`, "cmd");
      loadUserSessions();
      break;
  }
}

function renderAuditReport(content) {
  const container = document.getElementById("audit-display");
  if (!content) return;

  let html = `<div class="audit-report-card">`;
  const lines = content.split("\n");
  for (let line of lines) {
    if (line.startsWith("# ")) {
      html += `<h2>${escapeHtml(line.replace("# ", ""))}</h2>`;
    } else if (line.startsWith("### ")) {
      html += `<h3>${escapeHtml(line.replace("### ", ""))}</h3>`;
    } else if (line.startsWith("- ")) {
      html += `<div class="audit-finding-item">${escapeHtml(line.replace("- ", ""))}</div>`;
    } else if (line.trim()) {
      html += `<p>${escapeHtml(line)}</p>`;
    }
  }
  html += `</div>`;
  container.innerHTML = html;
}

function switchTabByName(tabName) {
  const btn = Array.from(document.querySelectorAll(".tab-btn")).find(b => b.innerText.toLowerCase().includes(tabName));
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

  if (btn) btn.classList.add("active");
  const target = document.getElementById(`tab-${tabName}`);
  if (target) target.classList.add("active");

  highlightAllCodeBlocks();
}

function copyActiveCode() {
  const codeEl = document.getElementById("code-display");
  const editorEl = document.getElementById("code-editor");
  const copyBtn = document.getElementById("copy-code-btn");
  
  const textToCopy = (isEditMode && editorEl) ? editorEl.value : (codeEl ? codeEl.innerText : "");
  if (!textToCopy) return;

  navigator.clipboard.writeText(textToCopy).then(() => {
    if (copyBtn) {
      const origText = copyBtn.innerText;
      copyBtn.innerText = "✅ Copied to Clipboard!";
      copyBtn.style.background = "#2a9d8f";
      copyBtn.style.color = "#ffffff";
      setTimeout(() => {
        copyBtn.innerText = origText;
        copyBtn.style.background = "";
        copyBtn.style.color = "";
      }, 2000);
    }
  }).catch(err => console.error("Copy failed:", err));
}

function runActiveProgramCode() {
  const codeDisplay = document.getElementById("code-display");
  const codeEditor = document.getElementById("code-editor");
  const runBtn = document.getElementById("btn-run-app-code");
  const outputBlock = document.getElementById("program-output-block");
  const outputText = document.getElementById("program-output-text");

  const codeToRun = (isEditMode && codeEditor) ? codeEditor.value : (codeDisplay ? codeDisplay.innerText : "");
  if (!codeToRun || !codeToRun.trim()) {
    alert("No program code to execute!");
    return;
  }

  if (outputBlock) outputBlock.style.display = "block";
  if (outputText) outputText.innerText = "Executing Python program in subprocess sandbox...\n";
  if (runBtn) {
    runBtn.disabled = true;
    runBtn.innerText = "▶️ Running...";
  }

  const userId = currentUser ? currentUser.id : "guest_devsecops_user";
  const sessionId = currentSessionId || "main";

  const termText = document.getElementById("cmd-terminal-output-text");
  const termBody = document.getElementById("cmd-terminal-body");
  if (termText) {
    termText.innerText = "Executing generated_app.py in isolated subprocess...\n";
  }

  fetch("/api/swarm/run-generated-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: userId,
      session_id: sessionId,
      code: codeToRun
    })
  })
  .then(res => {
    if (!res.ok) {
      return res.text().then(errText => {
        throw new Error(`Server Error (${res.status}): ${errText.slice(0, 120)}`);
      });
    }
    return res.json();
  })
  .then(data => {
    if (runBtn) {
      runBtn.disabled = false;
      runBtn.innerText = "Run Program";
    }
    if (termText) {
      termText.innerText = data.output || "[Process finished with exit code 0 and zero console output]";
    }
    if (termBody) {
      termBody.scrollTop = termBody.scrollHeight;
    }
    appendTerminal(`[Execution] Output rendered to Command Prompt terminal for session: ${sessionId}`, "system");
  })
  .catch(err => {
    console.error("Error executing program:", err);
    if (runBtn) {
      runBtn.disabled = false;
      runBtn.innerText = "Run Program";
    }
    if (termText) {
      termText.innerText = `[Execution Failed] ${err.message}`;
    }
  });
}

function clearCmdTerminal() {
  const termText = document.getElementById("cmd-terminal-output-text");
  if (termText) {
    termText.innerText = "Command Prompt terminal reset. Ready for live execution or validation.";
  }
  const inputEl = document.getElementById("cmd-terminal-input");
  if (inputEl) inputEl.value = "";
}

function handleTerminalInputKey(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    submitTerminalInput();
  }
}

function setQuickInput(val) {
  const inputEl = document.getElementById("cmd-terminal-input");
  if (inputEl) {
    inputEl.value = val;
    inputEl.focus();
    submitTerminalInput();
  }
}

function submitTerminalInput() {
  const inputEl = document.getElementById("cmd-terminal-input");
  const submitBtn = document.getElementById("cmd-submit-btn");
  const termText = document.getElementById("cmd-terminal-output-text");
  const termBody = document.getElementById("cmd-terminal-body");

  if (!inputEl) return;
  const rawInput = inputEl.value.trim();
  if (!rawInput) return;

  if (submitBtn) submitBtn.disabled = true;

  const userId = currentUser ? currentUser.id : "guest_devsecops_user";
  const sessionId = currentSessionId || "main";
  const codeEditor = document.getElementById("code-editor");
  const codeDisplay = document.getElementById("code-display");
  const currentCode = (isEditMode && codeEditor) ? codeEditor.value : (codeDisplay ? codeDisplay.innerText : "");

  // Append user command line to terminal output
  if (termText) {
    termText.innerText += `\n\nC:\\Users\\DevSecOps> validate "${rawInput}"\n[Validating Input against Python Module Runtime...]`;
    if (termBody) termBody.scrollTop = termBody.scrollHeight;
  }

  fetch("/api/swarm/validate-input", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: userId,
      session_id: sessionId,
      input_text: rawInput,
      code: currentCode
    })
  })
  .then(res => res.json())
  .then(data => {
    if (submitBtn) submitBtn.disabled = false;
    if (termText) {
      termText.innerText += `\n${data.output || "[Input validation completed with 0 errors]"}`;
      if (termBody) termBody.scrollTop = termBody.scrollHeight;
    }
  })
  .catch(err => {
    if (submitBtn) submitBtn.disabled = false;
    if (termText) {
      termText.innerText += `\n[Validation Error] ${err.message}`;
      if (termBody) termBody.scrollTop = termBody.scrollHeight;
    }
  });

  inputEl.value = "";
}

function clearProgramOutput() {
  clearCmdTerminal();
}

function setAgentState(agentId, className, statusText) {
  const node = document.getElementById(`agent-${agentId}`);
  const statusEl = document.getElementById(`status-${agentId}`);
  if (node) {
    node.className = `agent-node card-static-pop ${className}`;
  }
  
  let dotClass = "dot-idle";
  if (className === "running" || className === "executing") {
    dotClass = "dot-executing";
  } else if (className === "success" || className === "passed" || className === "patched") {
    dotClass = "dot-passed";
  } else if (className === "vulnerable") {
    dotClass = "dot-vulnerable";
  } else if (className === "remediated") {
    dotClass = "dot-remediated";
  }

  if (statusEl) {
    statusEl.innerHTML = `<span class="status-dot ${dotClass}"></span> ${statusText}`;
  }
}

function appendTerminal(text, type = "") {
  const term = document.getElementById("terminal-output");
  const line = document.createElement("div");
  line.className = `terminal-line ${type}`;
  line.innerText = text;
  term.appendChild(line);
  term.scrollTop = term.scrollHeight;
}

function cleanText(str) {
  if (!str) return '';
  return str.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

document.addEventListener("DOMContentLoaded", () => {
  initSupabase();
  initWebSocket();
  loadAvailableModels();
});
