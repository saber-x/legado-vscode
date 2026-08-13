import * as http from "http";
import * as https from "https";
import { ChildProcess, spawn } from "child_process";
import * as path from "path";
import * as vscode from "vscode";

interface StatusBarParagraph {
  text: string;
  chapterPos: number;
}

interface CatalogEntry {
  title: string;
  index: number;
}

export interface StatusBarBook {
  bookUrl: string;
  bookName: string;
  bookAuthor: string;
  catalog: CatalogEntry[];
}

export interface StatusBarChapter {
  title: string;
  chapterIndex: number;
  chapterPos: number;
  startAtEnd?: boolean;
  paragraphs: StatusBarParagraph[];
}

interface StatusBarSegment {
  text: string;
  chapterPos: number;
}

interface LegadoResponse<T> {
  isSuccess: boolean;
  data?: T;
  errorMsg?: string;
}

interface LegadoShelfBook {
  bookUrl: string;
  name: string;
  author: string;
  durChapterIndex?: number;
  durChapterPos?: number;
  durChapterTime?: number;
}

type LoadState = "loading" | "ready" | "failed";

export class StatusBarReader implements vscode.Disposable {
  private readonly _item: vscode.StatusBarItem;
  private readonly _disposables: vscode.Disposable[] = [];
  private _book: StatusBarBook | undefined;
  private _chapter: StatusBarChapter | undefined;
  private _segments: StatusBarSegment[] = [];
  private _segmentIndex = 0;
  private _contentRevealed = false;
  private _loadingChapter = false;
  private _restoringLastBook = false;
  private _bookRevision = 0;
  private _mouseMonitor: ChildProcess | undefined;
  private _mousePermissionWarningShown = false;
  private _autoHideTimer: NodeJS.Timeout | undefined;
  private _loadState: LoadState = "loading";

  public constructor(
    private readonly _postMessage: (message: unknown) => Thenable<boolean> | undefined,
    private readonly _extensionPath: string
  ) {
    this._item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, -10000);
    this._item.command = "legado-vscode.statusBarClick";
    this._render();

    this._disposables.push(
      this._item,
      vscode.commands.registerCommand("legado-vscode.statusBarClick", () =>
        this._handleStatusBarClick()
      ),
      vscode.commands.registerCommand("legado-vscode.statusBarNext", () => this.next()),
      vscode.commands.registerCommand("legado-vscode.statusBarPrevious", () => this.previous()),
      vscode.commands.registerCommand("legado-vscode.toggleStatusBar", () => this.toggle()),
      vscode.commands.registerCommand("legado-vscode.statusBarBossKey", () => this.bossKey()),
      vscode.commands.registerCommand("legado-vscode.statusBarClearFocus", () => {
        this.hideContent();
        return vscode.commands.executeCommand("workbench.statusBar.clearFocus");
      }),
      vscode.window.onDidChangeWindowState((state) => {
        if (!state.focused) {
          this.hideContent();
        }
      }),
      vscode.window.onDidChangeActiveTextEditor(() => this.hideContent()),
      vscode.window.onDidChangeTextEditorSelection(() => this.hideContent()),
      vscode.window.onDidChangeActiveTerminal(() => this.hideContent()),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("legado-vscode.webServeUrl") && !this._book) {
          void this.restoreLastReading();
        }
        if (
          !event.affectsConfiguration("legado-vscode.statusBar") &&
          !event.affectsConfiguration("legado-vscode.webServeUrl")
        ) {
          return;
        }
        this._rebuildSegments();
        if (this._contentRevealed) {
          const enabled = vscode.workspace
            .getConfiguration("legado-vscode.statusBar")
            .get<boolean>("enabled", true);
          if (enabled) {
            this._startMouseMonitor();
            this._restartAutoHideTimer();
          } else {
            this.hideContent();
          }
        }
        this._render();
      })
    );
  }

  public setBook(book: StatusBarBook) {
    if (
      !book ||
      typeof book.bookUrl !== "string" ||
      typeof book.bookName !== "string" ||
      !Array.isArray(book.catalog)
    ) {
      return;
    }

    const bookChanged = this._book?.bookUrl !== book.bookUrl;
    this._book = {
      ...book,
      catalog: book.catalog.filter(
        (chapter) => typeof chapter?.title === "string" && Number.isFinite(chapter.index)
      )
    };
    this._bookRevision++;
    if (bookChanged) {
      this.hideContent();
      this._chapter = undefined;
      this._segments = [];
      this._segmentIndex = 0;
      this._loadState = "loading";
      this._setHasBookContext(false);
      this._render();
    }
  }

  public setLoadFailed() {
    this.hideContent();
    this._book = undefined;
    this._bookRevision++;
    this._chapter = undefined;
    this._segments = [];
    this._segmentIndex = 0;
    this._loadState = "failed";
    this._setHasBookContext(false);
    this._render();
  }

  public async restoreLastReading() {
    if (this._restoringLastBook || this._book) {
      return;
    }

    this._restoringLastBook = true;
    this._loadState = "loading";
    this._render();
    const revision = this._bookRevision;
    try {
      const shelf = await this._request<LegadoResponse<LegadoShelfBook[]>>(
        "GET",
        "/getBookshelf"
      );
      const lastBook = shelf.data
        ?.filter(
          (book) =>
            typeof book.bookUrl === "string" &&
            typeof book.name === "string" &&
            Number.isFinite(book.durChapterTime)
        )
        .sort((first, second) => (second.durChapterTime || 0) - (first.durChapterTime || 0))[0];
      if (!shelf.isSuccess || !lastBook || revision !== this._bookRevision) {
        return;
      }

      const catalogResponse = await this._request<LegadoResponse<CatalogEntry[]>>(
        "GET",
        `/getChapterList?url=${encodeURIComponent(lastBook.bookUrl)}`
      );
      if (!catalogResponse.isSuccess || !catalogResponse.data?.length) {
        return;
      }

      const catalog = catalogResponse.data.filter(
        (chapter) => typeof chapter?.title === "string" && Number.isFinite(chapter.index)
      );
      if (catalog.length === 0) {
        return;
      }
      const chapterIndex = Math.min(
        Math.max(0, lastBook.durChapterIndex || 0),
        catalog.length - 1
      );
      const catalogEntry = catalog[chapterIndex];
      const chapterResponse = await this._request<LegadoResponse<string>>(
        "GET",
        `/getBookContent?url=${encodeURIComponent(lastBook.bookUrl)}&index=${catalogEntry.index}`
      );
      if (
        !chapterResponse.isSuccess ||
        typeof chapterResponse.data !== "string" ||
        revision !== this._bookRevision
      ) {
        return;
      }

      this.setBook({
        bookUrl: lastBook.bookUrl,
        bookName: lastBook.name,
        bookAuthor: lastBook.author || "",
        catalog
      });
      this.setChapter({
        title: catalogEntry.title,
        chapterIndex,
        chapterPos: lastBook.durChapterPos || 0,
        paragraphs: this._toParagraphs(chapterResponse.data)
      });
    } catch (error) {
      console.error("自动加载上次阅读的书失败", error);
    } finally {
      this._restoringLastBook = false;
      if (!this._book || !this._chapter) {
        this._loadState = "failed";
      }
      this._render();
    }
  }

  public setChapter(chapter: StatusBarChapter) {
    if (!chapter || !Array.isArray(chapter.paragraphs)) {
      return;
    }

    this._chapter = {
      ...chapter,
      paragraphs: chapter.paragraphs.filter(
        (paragraph) =>
          typeof paragraph?.text === "string" && Number.isFinite(paragraph.chapterPos)
      )
    };
    this._loadState = "ready";
    this._rebuildSegments();
    if (chapter.startAtEnd) {
      this._segmentIndex = Math.max(0, this._segments.length - 1);
    } else {
      const index = this._segments.findIndex(
        (segment) => segment.chapterPos >= chapter.chapterPos
      );
      this._segmentIndex = index === -1 ? 0 : index;
    }
    this._setHasBookContext(this._segments.length > 0);
    this._render();
    if (chapter.startAtEnd && this._segments.length > 0) {
      void this._syncProgress();
    }
  }

  public dispose() {
    this._stopMouseMonitor();
    this._stopAutoHideTimer();
    this._setHasBookContext(false);
    this._disposables.forEach((disposable) => disposable.dispose());
  }

  public hideContent() {
    if (!this._contentRevealed) {
      return;
    }
    this._contentRevealed = false;
    this._stopMouseMonitor();
    this._stopAutoHideTimer();
    this._render();
  }

  private _handleStatusBarClick() {
    if (this._loadState !== "ready" || this._segments.length === 0) {
      return vscode.commands.executeCommand("legado-vscode.openLegado");
    }
    return this._contentRevealed ? this.next() : this.revealContent();
  }

  private async next(fromMouseWheel = false) {
    if (!this._chapter || this._segments.length === 0 || this._loadingChapter) {
      return;
    }
    if (!fromMouseWheel) {
      this._startMouseMonitor();
    }
    this._restartAutoHideTimer();
    if (this._segmentIndex < this._segments.length - 1) {
      this._segmentIndex++;
      this._render();
      await this._syncProgress();
      return;
    }
    await this._navigateChapter(1);
  }

  private async previous(fromMouseWheel = false) {
    if (!this._chapter || this._segments.length === 0 || this._loadingChapter) {
      return;
    }
    if (!fromMouseWheel) {
      this._startMouseMonitor();
    }
    this._restartAutoHideTimer();
    if (this._segmentIndex > 0) {
      this._segmentIndex--;
      this._render();
      await this._syncProgress();
      return;
    }
    await this._navigateChapter(-1);
  }

  private async toggle() {
    const configuration = vscode.workspace.getConfiguration("legado-vscode.statusBar");
    const enabled = configuration.get<boolean>("enabled", true);
    await configuration.update("enabled", !enabled, vscode.ConfigurationTarget.Global);

    if (enabled) {
      this.hideContent();
      this._item.hide();
    } else if (this._segments.length > 0) {
      this._render();
    } else {
      vscode.window.showInformationMessage("请先在阅读APP插件中打开一本书。");
    }
  }

  private bossKey() {
    if (this._segments.length === 0) {
      return;
    }
    if (this._contentRevealed) {
      this.hideContent();
    } else {
      this.revealContent();
    }
  }

  private revealContent() {
    if (this._segments.length === 0) {
      return;
    }
    this._contentRevealed = true;
    this._startMouseMonitor();
    this._restartAutoHideTimer();
    this._render();
  }

  private _restartAutoHideTimer() {
    this._stopAutoHideTimer();
    if (!this._contentRevealed) {
      return;
    }
    const configuredSeconds = vscode.workspace
      .getConfiguration("legado-vscode.statusBar")
      .get<number>("autoHideSeconds", 10);
    const seconds = Number.isFinite(configuredSeconds)
      ? Math.min(600, Math.max(0, Math.floor(configuredSeconds)))
      : 10;
    if (seconds === 0) {
      return;
    }
    this._autoHideTimer = setTimeout(() => {
      this._autoHideTimer = undefined;
      this.hideContent();
    }, seconds * 1_000);
  }

  private _stopAutoHideTimer() {
    if (this._autoHideTimer) {
      clearTimeout(this._autoHideTimer);
      this._autoHideTimer = undefined;
    }
  }

  private _startMouseMonitor() {
    this._stopMouseMonitor();
    if (process.platform !== "darwin" || !this._contentRevealed) {
      return;
    }

    this._spawnMouseMonitor();
  }

  private _spawnMouseMonitor() {
    const configuration = vscode.workspace.getConfiguration("legado-vscode.statusBar");
    const configuredDelay = configuration.get<number>("mouseMoveDelay", 3);
    const mouseMoveDelay = Number.isFinite(configuredDelay)
      ? Math.min(60, Math.max(0, Math.floor(configuredDelay)))
      : 3;
    const wheelEnabled = configuration.get<boolean>("wheelEnabled", true);
    const monitor = spawn(
      path.join(this._extensionPath, "public", "mouse-monitor"),
      [String(mouseMoveDelay), wheelEnabled ? "1" : "0"],
      { stdio: ["ignore", "pipe", "ignore"] }
    );
    this._mouseMonitor = monitor;
    let output = "";
    monitor.stdout?.on("data", (data: Buffer) => {
      if (this._mouseMonitor !== monitor) {
        return;
      }
      output += data.toString("utf8");
      const events = output.split("\n");
      output = events.pop() || "";
      for (const event of events) {
        if (event === "previous") {
          void this.previous(true);
        } else if (event === "next") {
          void this.next(true);
        } else if (event === "moved") {
          this._mouseMonitor = undefined;
          this.hideContent();
          return;
        } else if (event === "permission-required" && !this._mousePermissionWarningShown) {
          this._mousePermissionWarningShown = true;
          void vscode.window
            .showWarningMessage(
              "滚轮翻页需要开启 macOS 的“输入监控”权限，授权后请完全退出并重新打开 VS Code。",
              "打开系统设置"
            )
            .then((choice) => {
              if (choice === "打开系统设置") {
                void vscode.env.openExternal(
                  vscode.Uri.parse(
                    "x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent"
                  )
                );
              }
            });
        }
      }
    });
    monitor.once("exit", () => {
      if (this._mouseMonitor === monitor) {
        this._mouseMonitor = undefined;
      }
    });
    monitor.once("error", () => {
      if (this._mouseMonitor === monitor) {
        this._mouseMonitor = undefined;
      }
    });
  }

  private _stopMouseMonitor() {
    const monitor = this._mouseMonitor;
    this._mouseMonitor = undefined;
    if (monitor && !monitor.killed) {
      monitor.kill();
    }
  }

  private async _navigateChapter(direction: -1 | 1) {
    if (!this._chapter) {
      return;
    }

    const targetIndex = this._chapter.chapterIndex + direction;
    if (this._book && (targetIndex < 0 || targetIndex >= this._book.catalog.length)) {
      vscode.window.showInformationMessage(direction > 0 ? "本章是最后一章" : "本章是第一章");
      return;
    }

    if (await this._sendToWebview({ command: "statusBarNavigateChapter", direction })) {
      return;
    }
    if (!this._book) {
      vscode.window.showErrorMessage("缺少书籍目录，请重新打开阅读页选择书籍。");
      return;
    }

    this._loadingChapter = true;
    try {
      const catalogEntry = this._book.catalog[targetIndex];
      const response = await this._request<LegadoResponse<string>>(
        "GET",
        `/getBookContent?url=${encodeURIComponent(this._book.bookUrl)}&index=${catalogEntry.index}`
      );
      if (!response.isSuccess || typeof response.data !== "string") {
        throw new Error(response.errorMsg || "获取章节内容失败");
      }
      this.setChapter({
        title: catalogEntry.title,
        chapterIndex: targetIndex,
        chapterPos: 0,
        startAtEnd: direction < 0,
        paragraphs: this._toParagraphs(response.data)
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`状态栏加载章节失败：${message}`);
    } finally {
      this._loadingChapter = false;
    }
  }

  private _rebuildSegments() {
    if (!this._chapter) {
      return;
    }

    const configuredLength = vscode.workspace
      .getConfiguration("legado-vscode.statusBar")
      .get<number>("maxLength", 60);
    const maxLength = Number.isFinite(configuredLength)
      ? Math.min(200, Math.max(20, Math.floor(configuredLength)))
      : 60;
    this._segments = this._chapter.paragraphs.flatMap((paragraph) =>
      this._splitText(paragraph.text, maxLength).map((text) => ({
        text,
        chapterPos: paragraph.chapterPos
      }))
    );
    this._segmentIndex = Math.min(this._segmentIndex, Math.max(0, this._segments.length - 1));
  }

  private _splitText(text: string, maxLength: number) {
    const normalized = text.replace(/\s+/g, " ").trim();
    const characters = Array.from(normalized);
    const result: string[] = [];
    let start = 0;

    while (start < characters.length) {
      let end = Math.min(start + maxLength, characters.length);
      if (end < characters.length) {
        const minEnd = start + Math.floor(maxLength / 2);
        for (let index = end - 1; index >= minEnd; index--) {
          if (/[，。！？；：,.!?;:\s]/.test(characters[index])) {
            end = index + 1;
            break;
          }
        }
      }

      const segment = characters.slice(start, end).join("").trim();
      if (segment) {
        result.push(segment);
      }
      start = end;
    }

    return result;
  }

  private _toParagraphs(content: string) {
    const imagePattern = /<img[^>]*src="[^"]*(?:"[^>]+\})?"[^>]*>/g;
    let chapterPos = -1;

    return content
      .split(/\n+/)
      .map((paragraph) => {
        chapterPos += paragraph.replace(imagePattern, " ").length + 1;
        return {
          text: this._toPlainText(paragraph),
          chapterPos
        };
      })
      .filter((paragraph) => paragraph.text);
  }

  private _toPlainText(content: string) {
    return content
      .replace(/<img[^>]*>/gi, "[图片]")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/&(amp|lt|gt|quot|apos|nbsp|#\d+|#x[\da-f]+);/gi, (_, entity: string) => {
        const namedEntities: Record<string, string> = {
          amp: "&",
          lt: "<",
          gt: ">",
          quot: "\"",
          apos: "'",
          nbsp: " "
        };
        const normalized = entity.toLowerCase();
        if (normalized.startsWith("#x")) {
          return String.fromCodePoint(parseInt(normalized.slice(2), 16));
        }
        if (normalized.startsWith("#")) {
          return String.fromCodePoint(parseInt(normalized.slice(1), 10));
        }
        return namedEntities[normalized] || "";
      })
      .trim();
  }

  private async _syncProgress() {
    if (!this._chapter) {
      return;
    }
    const segment = this._segments[this._segmentIndex];
    if (
      await this._sendToWebview({
        command: "statusBarProgress",
        chapterIndex: this._chapter.chapterIndex,
        chapterPos: segment.chapterPos
      })
    ) {
      return;
    }
    if (!this._book) {
      return;
    }

    try {
      await this._request("POST", "/saveBookProgress", {
        name: this._book.bookName,
        author: this._book.bookAuthor,
        durChapterIndex: this._chapter.chapterIndex,
        durChapterPos: segment.chapterPos,
        durChapterTime: Date.now(),
        durChapterTitle: this._chapter.title
      });
    } catch (error) {
      console.error("保存状态栏阅读进度失败", error);
    }
  }

  private async _sendToWebview(message: unknown) {
    return (await this._postMessage(message)) || false;
  }

  private _request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const baseUrl = vscode.workspace
      .getConfiguration("legado-vscode")
      .get<string>("webServeUrl", "http://127.0.0.1:1122");
    const url = new URL(path, `${baseUrl.replace(/\/+$/, "")}/`);
    const data = body === undefined ? undefined : JSON.stringify(body);
    const transport = url.protocol === "https:" ? https : http;
    const headers: http.OutgoingHttpHeaders = {};
    if (data) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(data);
    }

    return new Promise((resolve, reject) => {
      const request = transport.request(
        url,
        {
          method,
          headers: data ? headers : undefined
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
          response.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf8");
            if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
              reject(new Error(`HTTP ${response.statusCode || 0}`));
              return;
            }
            try {
              resolve(JSON.parse(text) as T);
            } catch {
              reject(new Error("阅读服务返回了无效数据"));
            }
          });
        }
      );
      request.setTimeout(10000, () => request.destroy(new Error("请求超时")));
      request.on("error", reject);
      if (data) {
        request.write(data);
      }
      request.end();
    });
  }

  private _setHasBookContext(value: boolean) {
    void vscode.commands.executeCommand("setContext", "legado-vscode.statusBar.hasBook", value);
  }

  private _render() {
    const enabled = vscode.workspace
      .getConfiguration("legado-vscode.statusBar")
      .get<boolean>("enabled", true);
    if (!enabled) {
      this._item.hide();
      return;
    }

    const segment = this._segments[this._segmentIndex];
    if (!this._chapter || !segment) {
      this._item.text = "$(book)";
      this._item.tooltip =
        this._loadState === "loading"
          ? "正在自动加载上次阅读的书…"
          : "未能加载书籍，单击打开阅读APP书架";
      this._item.show();
      return;
    }

    if (!this._contentRevealed) {
      this._item.text = "$(book)";
      this._item.tooltip = `${this._chapter.title}\n单击显示正文`;
      this._item.show();
      return;
    }

    this._item.text = segment.text.replace(/\$\(/g, "\\$(");
    this._item.tooltip = `${this._chapter.title}\n第 ${this._segmentIndex + 1} / ${
      this._segments.length
    } 段\n单击显示下一段；空格键快速隐藏`;
    this._item.show();
  }
}
