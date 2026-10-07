import { debounce, ItemView, type TAbstractFile, type WorkspaceLeaf } from "obsidian";
import { extractHighlights, groupHighlights, noteName, type GroupBy, type Highlight } from "./highlights";

export const HIGHLIGHTS_VIEW = "read-later-highlights";

export class HighlightsView extends ItemView {
  private groupBy: GroupBy = "tag";

  constructor(
    leaf: WorkspaceLeaf,
    private folder: () => string,
  ) {
    super(leaf);
  }

  getViewType() {
    return HIGHLIGHTS_VIEW;
  }

  getDisplayText() {
    return "Highlights";
  }

  getIcon() {
    return "highlighter";
  }

  async onOpen() {
    const rerender = debounce(() => void this.refresh(), 400, true);
    const inFolder = (path: string) => path.startsWith(`${this.folder()}/`);
    this.registerEvent(this.app.metadataCache.on("changed", (file) => inFolder(file.path) && rerender()));
    this.registerEvent(this.app.vault.on("delete", (file: TAbstractFile) => inFolder(file.path) && rerender()));
    this.registerEvent(this.app.vault.on("rename", (file, old) => (inFolder(file.path) || inFolder(old)) && rerender()));
    await this.refresh();
  }

  private async collect(): Promise<Highlight[]> {
    const files = this.app.vault
      .getMarkdownFiles()
      .filter((f) => f.path.startsWith(`${this.folder()}/`))
      .sort((a, b) => a.path.localeCompare(b.path));
    const perFile = await Promise.all(files.map(async (f) => extractHighlights(f.path, await this.app.vault.cachedRead(f))));
    return perFile.flat();
  }

  private async refresh() {
    const highlights = await this.collect();
    const root = this.contentEl;
    root.empty();
    root.addClass("read-later-highlights");

    const header = root.createDiv({ cls: "rl-header" });
    header.createSpan({ cls: "rl-count", text: `${highlights.length} highlight${highlights.length === 1 ? "" : "s"}` });
    const toggle = header.createDiv({ cls: "rl-toggle" });
    for (const [by, label] of [
      ["tag", "By tag"],
      ["note", "By note"],
    ] as const) {
      const button = toggle.createEl("button", { text: label, cls: by === this.groupBy ? "is-active" : "" });
      button.setAttribute("aria-pressed", String(by === this.groupBy));
      button.onclick = () => {
        this.groupBy = by;
        void this.refresh();
      };
    }

    if (!highlights.length) {
      root.createDiv({ cls: "rl-empty", text: "No highlights yet. Wrap text in ==double equals== in a reading note, then add #tags after it." });
      return;
    }

    for (const group of groupHighlights(highlights, this.groupBy)) {
      const section = root.createDiv({ cls: "rl-group" });
      const title = section.createDiv({ cls: "rl-group-title" });
      title.createSpan({ text: group.label });
      title.createSpan({ cls: "rl-group-count", text: String(group.items.length) });
      for (const h of group.items) this.card(section, h);
    }
  }

  private card(parent: HTMLElement, h: Highlight) {
    const card = parent.createDiv({ cls: "rl-card", attr: { role: "button", tabindex: "0" } });
    card.createDiv({ cls: "rl-card-text", text: h.text });
    const tags = this.groupBy === "note" && h.tags.length ? ` · ${h.tags.join(" ")}` : "";
    card.createDiv({ cls: "rl-card-source", text: `${noteName(h.file)} · line ${h.line + 1}${tags}` });
    const open = () => void this.openHighlight(h);
    card.onclick = open;
    card.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    };
  }

  private async openHighlight(h: Highlight) {
    const file = this.app.vault.getFileByPath(h.file);
    if (!file) return;
    await this.app.workspace.getLeaf(false).openFile(file, { eState: { line: h.line } });
  }
}
