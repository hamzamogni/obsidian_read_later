const DEFAULT_PORT = 27181;
const $ = (id) => document.getElementById(id);

function show(text, kind) {
  $("status").textContent = text;
  $("status").className = kind;
}

function fields() {
  return { token: $("token").value.trim(), port: Number($("port").value) || DEFAULT_PORT };
}

async function showQueue() {
  const { queue = [] } = await chrome.storage.local.get("queue");
  $("queue").textContent = queue.length ? `${queue.length} ${queue.length === 1 ? "link is" : "links are"} waiting for Obsidian.` : "";
}

async function load() {
  const { token = "", port = DEFAULT_PORT } = await chrome.storage.local.get(["token", "port"]);
  $("token").value = token;
  $("port").value = port;
  await showQueue();
}

$("save").addEventListener("click", async () => {
  await chrome.storage.local.set(fields());
  show("Saved.", "ok");
});

$("test").addEventListener("click", async () => {
  const { token, port } = fields();
  if (!token) return show("Paste the token from the Obsidian plugin settings first.", "error");
  show("Testing…", "");
  try {
    const res = await fetch(`http://127.0.0.1:${port}/ping`, { headers: { "x-read-later-token": token } });
    if (res.ok) show(`Connected to Obsidian on port ${port}.`, "ok");
    else if (res.status === 403) show("Obsidian answered, but the token is wrong.", "error");
    else show(`Obsidian answered with HTTP ${res.status}.`, "error");
  } catch {
    show(`Nothing is listening on port ${port}. Is desktop Obsidian open with the Read later plugin enabled?`, "error");
  }
});

chrome.storage.onChanged.addListener((changes) => changes.queue && showQueue());
load();
