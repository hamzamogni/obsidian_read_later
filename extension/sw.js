const DEFAULT_PORT = 27181;
const GREEN = "#16a34a";
const AMBER = "#d97706";
const RED = "#dc2626";

async function settings() {
  const { token = "", port = DEFAULT_PORT } = await chrome.storage.local.get(["token", "port"]);
  return { token: String(token).trim(), port: Number(port) || DEFAULT_PORT };
}

async function readQueue() {
  return (await chrome.storage.local.get({ queue: [] })).queue;
}

async function badge(text, color) {
  await chrome.action.setBadgeText({ text });
  if (color) await chrome.action.setBadgeBackgroundColor({ color });
}

let queueLock = Promise.resolve();
const withQueueLock = (task) => (queueLock = queueLock.then(task, task));

async function flush() {
  const { token, port } = await settings();
  const queue = await readQueue();
  if (!token) return badge("!", RED);

  const left = [];
  let rejected = false;
  for (const item of queue) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/save`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-read-later-token": token },
        body: JSON.stringify({ url: item.url, title: item.title }),
      });
      if (res.status === 403) rejected = true;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      left.push(item);
    }
  }
  await chrome.storage.local.set({ queue: left });

  if (rejected) return badge("!", RED);
  if (left.length) return badge(String(left.length), AMBER);
  if (!queue.length) return badge("");
  await badge("✓", GREEN);
  setTimeout(() => withQueueLock(async () => {
    if (!(await readQueue()).length) await badge("");
  }), 1500);
}

function save(url, title) {
  if (!/^https?:\/\//.test(url ?? "")) return Promise.resolve();
  return withQueueLock(async () => {
    await chrome.storage.local.set({ queue: [...(await readQueue()), { url, title, savedAt: new Date().toISOString() }] });
    await flush();
  });
}

chrome.action.onClicked.addListener(async (tab) => {
  await save(tab.url, tab.title);
  if (!(await settings()).token) chrome.runtime.openOptionsPage();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.linkUrl) save(info.linkUrl);
  else save(info.pageUrl ?? tab?.url, tab?.title);
});

function ensureAlarm() {
  chrome.alarms.get("flush", (alarm) => alarm || chrome.alarms.create("flush", { periodInMinutes: 1 }));
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => chrome.contextMenus.create({ id: "read-later", title: "Read later", contexts: ["link", "page"] }));
  ensureAlarm();
  withQueueLock(flush);
});

chrome.runtime.onStartup.addListener(() => {
  ensureAlarm();
  withQueueLock(flush);
});

chrome.alarms.onAlarm.addListener((alarm) => alarm.name === "flush" && withQueueLock(flush));

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.token || changes.port)) withQueueLock(flush);
});

ensureAlarm();
