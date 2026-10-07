import { normalizePath, Notice, Platform, PluginSettingTab, Setting, type App, type Plugin } from "obsidian";

export type Settings = {
  inboxPath: string;
  readingFolder: string;
  port: number;
  token: string;
};

export const DEFAULT_PORT = 27181;

export function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const str = (v: unknown, fallback: string) => (typeof v === "string" && v.trim() ? v.trim() : fallback);

export function parseSettings(data: unknown): Settings {
  const d = (data ?? {}) as Record<string, unknown>;
  const port = Number(d.port);
  return {
    inboxPath: normalizePath(str(d.inboxPath, "000- Inbox.md")),
    readingFolder: normalizePath(str(d.readingFolder, "01-Resources/Reading")),
    port: Number.isInteger(port) && port > 0 && port < 65536 ? port : DEFAULT_PORT,
    token: str(d.token, newToken()),
  };
}

type Host = Plugin & {
  settings: Settings;
  saveSettings(change: Partial<Settings>): Promise<void>;
};

export class ReadLaterSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private host: Host,
  ) {
    super(app, host);
  }

  display(): void {
    const { containerEl } = this;
    const s = this.host.settings;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Inbox note")
      .setDesc("Links added to this note become reading notes.")
      .addText((t) =>
        t.setPlaceholder("000- Inbox.md").setValue(s.inboxPath).onChange(async (v) => {
          if (v.trim()) await this.host.saveSettings({ inboxPath: normalizePath(v.trim()) });
        }),
      );

    new Setting(containerEl)
      .setName("Reading folder")
      .setDesc("Where reading notes are created. The highlights panel scans only this folder.")
      .addText((t) =>
        t.setPlaceholder("01-Resources/Reading").setValue(s.readingFolder).onChange(async (v) => {
          if (v.trim()) await this.host.saveSettings({ readingFolder: normalizePath(v.trim()) });
        }),
      );

    if (!Platform.isDesktopApp) return;

    new Setting(containerEl).setName("Browser capture").setHeading();

    new Setting(containerEl)
      .setName("Port")
      .setDesc("The Chrome extension sends links to http://127.0.0.1:<port>/save.")
      .addText((t) =>
        t.setValue(String(s.port)).onChange(async (v) => {
          const port = Number(v);
          if (Number.isInteger(port) && port > 0 && port < 65536) await this.host.saveSettings({ port });
        }),
      );

    new Setting(containerEl)
      .setName("Token")
      .setDesc("Paste this into the extension's options. Regenerating it disconnects the extension until you paste the new one.")
      .addText((t) => {
        t.setValue(s.token).setDisabled(true);
        t.inputEl.addClass("read-later-token");
      })
      .addExtraButton((b) =>
        b
          .setIcon("copy")
          .setTooltip("Copy token")
          .onClick(async () => {
            await navigator.clipboard.writeText(this.host.settings.token);
            new Notice("Token copied");
          }),
      )
      .addExtraButton((b) =>
        b
          .setIcon("refresh-cw")
          .setTooltip("Regenerate token")
          .onClick(async () => {
            await this.host.saveSettings({ token: newToken() });
            this.display();
          }),
      );
  }
}
