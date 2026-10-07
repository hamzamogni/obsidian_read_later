import { debounce, Notice, Plugin, requestUrl } from "obsidian";
import { Expander } from "./expander";
import type { Http } from "./fetchers/http";
import { appendToInbox, type Capture } from "./inbox";
import { parseSettings, ReadLaterSettingTab, type Settings } from "./settings";

const http: Http = async (req) => {
  const res = await requestUrl({ ...req, throw: false });
  return { status: res.status, text: res.text, headers: res.headers };
};

export function queueBase(folder: string): string {
  return [
    "filters:",
    "  and:",
    `    - file.inFolder(${JSON.stringify(folder)})`,
    `    - 'status == "unread"'`,
    "views:",
    "  - type: table",
    "    name: Unread",
    "    order:",
    "      - file.name",
    "      - type",
    "      - author",
    "      - saved",
    "    sort:",
    "      - property: saved",
    "        direction: DESC",
    "",
  ].join("\n");
}

export default class ReadLaterPlugin extends Plugin {
  declare settings: Settings;
  private expander!: Expander;

  async onload() {
    this.settings = parseSettings(await this.loadData());
    await this.saveData(this.settings);
    this.expander = new Expander(this.app, () => this.settings, http);
    this.addSettingTab(new ReadLaterSettingTab(this.app, this));

    this.addCommand({ id: "process-inbox", name: "Process inbox", callback: () => this.expander.run() });

    this.registerObsidianProtocolHandler("read-later", async ({ url, comment, title }) => {
      if (!url || !/^https?:\/\//.test(url)) {
        new Notice("Read later: the link needs a url=http(s)://… parameter");
        return;
      }
      await this.capture({ url, comment, title });
    });

    const onInboxChange = debounce(
      async () => {
        const inbox = this.app.vault.getFileByPath(this.settings.inboxPath);
        if (inbox && (await this.app.vault.read(inbox)) !== this.expander.lastInboxWrite) await this.expander.run();
      },
      1500,
      true,
    );
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file.path === this.settings.inboxPath) onInboxChange();
      }),
    );

    this.app.workspace.onLayoutReady(async () => {
      await this.ensureVaultFiles();
      await this.expander.run();
    });
  }

  async saveSettings(change: Partial<Settings>) {
    this.settings = { ...this.settings, ...change };
    await this.saveData(this.settings);
  }

  async capture(capture: Capture) {
    const { vault } = this.app;
    const inbox = vault.getFileByPath(this.settings.inboxPath) ?? (await vault.create(this.settings.inboxPath, ""));
    await vault.process(inbox, (text) => appendToInbox(text, capture));
    await this.expander.run();
  }

  private async ensureFolder(path: string) {
    const parts = path.split("/").filter(Boolean);
    for (let i = 1; i <= parts.length; i++) {
      const sub = parts.slice(0, i).join("/");
      if (!this.app.vault.getAbstractFileByPath(sub)) await this.app.vault.createFolder(sub).catch(() => undefined);
    }
  }

  private async ensureVaultFiles() {
    const { vault } = this.app;
    const { inboxPath, readingFolder } = this.settings;
    await this.ensureFolder(readingFolder);
    await this.ensureFolder(inboxPath.split("/").slice(0, -1).join("/"));
    if (!vault.getAbstractFileByPath(inboxPath)) await vault.create(inboxPath, "");
    const base = `${readingFolder}/Reading queue.base`;
    if (!vault.getAbstractFileByPath(base)) await vault.create(base, queueBase(readingFolder));
  }
}
