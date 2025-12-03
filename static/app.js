(function () {
  const storedCid = localStorage.getItem("xo_cid");
  const cid = storedCid || Math.random().toString(36).slice(2);
  localStorage.setItem("xo_cid", cid);

  (function applySavedTheme() {
    const saved = localStorage.getItem("xo_theme") || "dark";
    try {
      document.documentElement.dataset.theme = saved;
    } catch (e) {}
  })();

  let mySymbol = null;
  let myName = null;
  let state = null;
  let lastWinnerSeen = null;
  let busy = false;

  function q(id) { return document.getElementById(id); }
  async function postJSON(url, body) {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return r.json();
  }
  async function getJSON(url) {
    const r = await fetch(url);
    return r.json();
  }

  function escapeHtml(s = "") {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function openThemeMenu(open) {
    const btn = q("themeBtn"), menu = q("themeMenu");
    if (!btn || !menu) return;
    if (open) {
      menu.style.display = "block";
      btn.setAttribute("aria-expanded", "true");
      menu.setAttribute("aria-hidden", "false");
    } else {
      menu.style.display = "none";
      btn.setAttribute("aria-expanded", "false");
      menu.setAttribute("aria-hidden", "true");
    }
  }
  function applyTheme(name) {
    try {
      document.documentElement.dataset.theme = name;
      localStorage.setItem("xo_theme", name);
      openThemeMenu(false);
    } catch (e) { console.warn("applyTheme err", e); }
  }

  async function postResetBoardWithFallback() {
    const cached = localStorage.getItem("xo_backend_origin");
    const host = location.hostname || "127.0.0.1";
    const candidates = [];
    if (cached) candidates.push(cached);
    candidates.push(location.origin);
    candidates.push(`http://${host}:5000`);
    candidates.push(`http://${host}:8000`);
    candidates.push(`http://${host}:3000`);
    candidates.push(`http://${host}:8080`);
    const uniq = [...new Set(candidates.filter(Boolean))];

    let lastErr = null;
    for (const origin of uniq) {
      const url = origin + "/reset_board";
      try {
        console.log("Trying reset:", url);
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
        const txt = await res.text().catch(() => null);
        console.log("Result", origin, res.status);
        if (!res.ok) { lastErr = { origin, status: res.status, body: txt }; continue; }
        try {
          const json = txt ? JSON.parse(txt) : null;
          localStorage.setItem("xo_backend_origin", origin);
          return { ok: true, origin, json, body: txt };
        } catch (e) {
          localStorage.setItem("xo_backend_origin", origin);
          return { ok: true, origin, json: null, body: txt };
        }
      } catch (e) {
        lastErr = { origin, error: String(e) };
        console.warn("Try failed", origin, e);
      }
    }
    return { ok: false, error: lastErr, tried: uniq };
  }

  function renderGameState() {
    if (!state) return;
    const bd = state.board || [];
    document.querySelectorAll(".cell").forEach(c => {
      const pos = parseInt(c.dataset.pos);
      c.innerText = bd[pos] || "";
      c.classList.toggle("taken", !!bd[pos]);
      c.classList.remove("to-be-removed");
    });
    if (q("turn")) q("turn").innerText = state.current_turn || "-";
    if (q("winner")) q("winner").innerText = state.winner || "-";
    if (q("xlist")) q("xlist").innerText = (state.placements && state.placements.X ? state.placements.X.map(p => p.pos).join(", ") : "");
    if (q("olist")) q("olist").innerText = (state.placements && state.placements.O ? state.placements.O.map(p => p.pos).join(", ") : "");

    try {
      const pls = state.placements || {};
      ["X", "O"].forEach(sym => {
        const arr = pls[sym];
        if (Array.isArray(arr) && arr.length === 3) {
          const earliest = arr[0];
          const p = earliest && earliest.pos;
          if (typeof p === "number") {
            const cell = document.querySelector(`.cell[data-pos="${p}"]`);
            if (cell) cell.classList.add("to-be-removed");
          }
        }
      });
    } catch (err) { console.warn("renderGameState highlight err", err); }
  }

  async function fetchState() {
    try {
      const s = await getJSON("/state");
      state = s;
      renderGameState();
      handleWinnerPopupIfNeeded();
    } catch (e) { console.error("fetchState err", e); }
  }

  async function refreshClients() {
    try {
      const j = await getJSON("/clients");
      if (!j || !j.ok) return;
      renderClients(j.clients || []);
    } catch (e) { console.error("refreshClients err", e); }
  }

  function renderClients(clients) {
    const container = q("clientsList");
    if (!container) return;
    container.innerHTML = "";
    clients.sort((a, b) => {
      if (a.role === b.role) return (a.name || "").localeCompare(b.name || "");
      return a.role === "player" ? -1 : 1;
    });
    for (const c of clients) {
      const row = document.createElement("div");
      row.className = "client-row";
      const left = document.createElement("div");
      left.className = "left";
      const nameEl = document.createElement("div");
      nameEl.className = "client-name";
      nameEl.textContent = c.name || "Player";
      const metaEl = document.createElement("div");
      metaEl.className = "client-meta";
      metaEl.textContent = c.role + (c.symbol ? " • " + c.symbol : "");
      left.appendChild(nameEl);
      left.appendChild(metaEl);

      const right = document.createElement("div");
      right.className = "right";
      const btn = document.createElement("button");
      btn.innerText = "Challenge";
      if (c.cid === cid) {
        btn.style.display = "none";
      } else {
        btn.addEventListener("click", () => sendChallenge(c.cid));
      }
      right.appendChild(btn);

      row.appendChild(left);
      row.appendChild(right);
      container.appendChild(row);
    }
  }

  async function sendChallenge(to_cid) {
    try {
      const j = await postJSON("/challenge", { from_cid: cid, to_cid });
      console.log("challenge:", j);
      if (!j || !j.ok) alert("Challenge failed: " + (j && j.msg));
      else alert("Challenge sent");
    } catch (e) { console.error("sendChallenge err", e); alert("Network error while sending challenge"); }
  }

  async function pollChallenges() {
    try {
      const mycid = localStorage.getItem("xo_cid");
      if (!mycid) return;

      const incoming = await getJSON("/challenges?cid=" + encodeURIComponent(mycid));
      if (incoming && incoming.ok) {
        for (const c of incoming.challenges || []) {
          if (c.status === "pending" && c.to_cid === mycid) {
            const seenKey = "chal_seen_" + c.id;
            if (localStorage.getItem(seenKey)) continue;
            const clientsResp = await getJSON("/clients");
            const challengerName = (clientsResp.clients.find(x => x.cid === c.from_cid) || {}).name || "Someone";
            const accept = confirm("Challenge from " + challengerName + ". Accept?");
            const resp = accept ? "accepted" : "declined";
            const r = await postJSON("/challenge/respond", {
              cid: mycid,
              challenge_id: c.id,
              response: resp
            });
            console.log("responded:", r);
            localStorage.setItem(seenKey, "1");
            if (accept) alert("You accepted the challenge.");
          }
        }
      }

      const outgoing = await getJSON("/challenges?from=" + encodeURIComponent(mycid));
      if (outgoing && outgoing.ok) {
        for (const c of outgoing.challenges || []) {
          const shownKey = "chal_out_shown_" + c.id;
          if (c.status !== "pending" && !localStorage.getItem(shownKey)) {
            const clientsResp = await getJSON("/clients");
            const targetName = (clientsResp.clients.find(x => x.cid === c.to_cid) || {}).name || "Target";
            if (c.status === "accepted") alert(targetName + " accepted your challenge.");
            else if (c.status === "declined") alert(targetName + " declined your challenge.");
            localStorage.setItem(shownKey, "1");
          }
        }
      }
    } catch (e) { console.error("pollChallenges err", e); }
  }

  async function makeMove(pos) {
    if (busy) return;
    if (!localStorage.getItem("xo_joined")) { alert("Join first."); return; }
    if (!state) { alert("Wait a second."); return; }
    const myClient = (state.clients && state.clients[cid]) || null;
    if (!myClient || myClient.role !== "player") { alert("You are not a player."); return; }
    if (state.current_turn !== myClient.symbol) { alert("Not your turn."); return; }
    busy = true;
    try {
      const r = await postJSON("/move", { cid, pos });
      console.log("move:", r);
      if (!r || !r.ok) alert("Move failed: " + (r && r.msg));
      await fetchState();
    } catch (e) { console.error("makeMove err", e); }
    busy = false;
  }

  function handleWinnerPopupIfNeeded() {
    if (!state) return;
    const w = state.winner || null;
    if (!w) { lastWinnerSeen = null; return; }
    if (lastWinnerSeen === w) return;
    lastWinnerSeen = w;
    const myclient = (state.clients && state.clients[cid]) || null;
    const amIWinner = myclient && myclient.symbol === w;
    showWinnerModal(w, amIWinner);
  }

  function spawnConfetti() {
    const container = q("confettiContainer");
    if (!container) return;
    container.innerHTML = "";
    const emojis = ["🎉","✨","🎊","🥳","💥","🌟"];
    for (let i = 0; i < 14; i++) {
      const el = document.createElement("div");
      el.className = "c";
      el.style.left = (10 + Math.random()*300) + "px";
      el.style.fontSize = (14 + Math.floor(Math.random()*18)) + "px";
      el.style.animationDelay = (Math.random()*400) + "ms";
      el.innerText = emojis[Math.floor(Math.random()*emojis.length)];
      container.appendChild(el);
    }
  }

  function showWinnerModal(winnerSymbol, amIWinner) {
    const overlay = q("xoModalOverlay");
    const modal = q("xoModal");
    const title = q("xoModalTitle");
    const message = q("xoModalMessage");
    const ok = q("xoModalOk");
    const conf = q("confettiContainer");
    if (conf) conf.innerHTML = "";
    modal.classList.remove("winner","loser");

    if (amIWinner) {
      modal.classList.add("winner");
      if (title) title.innerText = "You Win!";
      if (message) message.innerText = `Congratulations — ${winnerSymbol} wins!`;
      spawnConfetti();
    } else {
      modal.classList.add("loser");
      if (title) title.innerText = "Sorry!";
      if (message) message.innerText = `Player ${winnerSymbol} formed a line. Better luck next time.`;
    }

    overlay.style.display = "flex";
    overlay.setAttribute("aria-hidden", "false");

    async function onOk() {
      overlay.style.display = "none";
      overlay.setAttribute("aria-hidden", "true");
      ok.removeEventListener("click", onOk);
      try {
        const result = await postResetBoardWithFallback();
        console.log("reset result", result);
        if (!result.ok) { alert("Board reset failed."); return; }
        await fetchState();
        await refreshClients();
      } catch (e) {
        console.error("reset err", e);
        alert("Reset failed (network).");
      }
    }
    ok.addEventListener("click", onOk);
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (q("cid")) q("cid").innerText = cid.slice(0, 8);

    const themeBtn = q("themeBtn"), themeMenu = q("themeMenu");
    if (themeBtn && themeMenu) {
      themeBtn.addEventListener("click", (ev) => {
        const shown = themeMenu.style.display === "block";
        openThemeMenu(!shown);
      });
      document.addEventListener("click", (ev) => {
        if (!themeMenu.contains(ev.target) && ev.target !== themeBtn) openThemeMenu(false);
      });
      document.querySelectorAll(".theme-option").forEach(opt => {
        opt.addEventListener("click", (e) => {
          const name = e.currentTarget.dataset.theme;
          applyTheme(name);
        });
      });
    }

    const boardEl = q("board");
    if (boardEl) {
      boardEl.addEventListener("pointerdown", (ev) => {
        const cell = ev.target.closest(".cell");
        if (!cell) return;
        ev.preventDefault();
        const pos = parseInt(cell.dataset.pos);
        makeMove(pos);
      }, { passive: false });
    }

    const joinBtn = q("joinBtn"), leaveBtn = q("leaveBtn"), clearBtn = q("clearSessionsBtn"),
      nameInput = q("nameInput"), resetBtn = q("resetBtn");

    if (joinBtn) joinBtn.addEventListener("click", async () => {
      const name = (nameInput.value || "Player").trim();
      try {
        const j = await postJSON("/join", { cid, name });
        console.log("join:", j);
        if (!j || !j.ok) { alert("Join failed"); return; }
        mySymbol = j.symbol; myName = j.name || name;
        localStorage.setItem("xo_joined", "1"); localStorage.setItem("xo_name", myName);
        if (q("mysym")) q("mysym").innerText = mySymbol || "-";
        if (q("myname")) q("myname").innerText = myName || "-";
        if (q("joinPanel")) q("joinPanel").style.display = "none";
        if (q("lobby")) q("lobby").style.display = "block";
        await refreshClients();
      } catch (e) { console.error("join err", e); alert("Join error"); }
    });

    if (leaveBtn) leaveBtn.addEventListener("click", () => {
      localStorage.removeItem("xo_joined");
      localStorage.removeItem("xo_name");
      mySymbol = null; myName = null;
      if (q("lobby")) q("lobby").style.display = "none";
      if (q("joinPanel")) q("joinPanel").style.display = "block";
    });

    if (clearBtn) clearBtn.addEventListener("click", async () => {
      if (!confirm("Clear server sessions?")) return;
      try {
        await postJSON("/clear_sessions", {});
        localStorage.removeItem("xo_joined"); localStorage.removeItem("xo_name");
        mySymbol = null; myName = null;
        if (q("lobby")) q("lobby").style.display = "none";
        if (q("joinPanel")) q("joinPanel").style.display = "block";
        await fetchState();
        await refreshClients();
      } catch (e) { console.error("clearSessions err", e); alert("Network error"); }
    });

    if (resetBtn) {
      resetBtn.addEventListener("click", async () => {
        if (!confirm("Reset the board? This will clear the matrix but keep players.")) return;
        try {
          const result = await postResetBoardWithFallback();
          console.log("reset fallback ->", result);
          if (!result.ok) { alert("Board reset failed. See console."); return; }
          await fetchState();
          await refreshClients();
          alert("Board reset. Players remain in the lobby.");
        } catch (e) { console.error("reset err", e); alert("Network error while resetting board"); }
      });
    }

    const joined = localStorage.getItem("xo_joined");
    const savedName = localStorage.getItem("xo_name") || "";
    if (joined && nameInput) {
      nameInput.value = savedName;
      postJSON("/join", { cid, name: savedName || "Player" })
      .then(j => {
        if (j.ok) {
          mySymbol = j.symbol;
          myName = j.name || savedName;
          if (q("mysym")) q("mysym").innerText = mySymbol || "-";
          if (q("myname")) q("myname").innerText = myName || "-";
          if (q("joinPanel")) q("joinPanel").style.display = "none";
          if (q("lobby")) q("lobby").style.display = "block";
        }
      });
    }

    fetchState();
    refreshClients();
  });

  (function () {
    const POLL_MS = 900;
    const IDLE_MS = 5000;
    let pollTimer = null;

    async function doPoll() {
      try {
        await fetchState();
        await refreshClients();
        await pollChallenges();
      } catch (e) {
        console.warn("poll err:", e);
      }
    }

    function startPolling(interval = POLL_MS) {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(doPoll, interval);
      doPoll();
      console.log("Polling started @", interval, "ms");
    }

    function stopPolling() {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    }

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        startPolling(POLL_MS);
        doPoll();
      } else {
        startPolling(IDLE_MS);
      }
    });

    window.addEventListener("focus", () => {
      doPoll();
    });

    if (document.readyState === "complete" || document.readyState === "interactive")
      startPolling();
    else
      document.addEventListener("DOMContentLoaded", () => startPolling());

    window._xo = window._xo || {};
    window._xo.startPolling = startPolling;
    window._xo.stopPolling = stopPolling;
  })();

  window._xo = window._xo || {};
  window._xo.fetchState = fetchState;
  window._xo.postResetBoardWithFallback = postResetBoardWithFallback;
  window._xo.cid = cid;

})();
