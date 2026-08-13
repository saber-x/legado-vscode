import * as vscode from "vscode";
import { getUri } from "./utilities/getUri";
import { StatusBarBook, StatusBarChapter, StatusBarReader } from "./StatusBarReader";

export class WebAppPanel {
  public static currentPanel: WebAppPanel | undefined;
  private static _statusBarReader: StatusBarReader | undefined;

  public static readonly viewType = "legado-vscode:panel";

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  public static setStatusBarReader(reader: StatusBarReader) {
    WebAppPanel._statusBarReader = reader;
  }

  public static postMessage(message: unknown) {
    return WebAppPanel.currentPanel?._panel.webview.postMessage(message);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    // Set the webview's initial html content
    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Update the content based on view changes
    this._panel.onDidChangeViewState(
      (e) => {
        if (this._panel.visible) {
          this._update();
        }
      },
      null,
      this._disposables
    );

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(this._messageListener, null, this._disposables);
    this._disposables.push(
      vscode.window.onDidChangeActiveColorTheme((theme) => this._postColorMode(theme))
    );
  }

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = (vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined) || vscode.ViewColumn.One;

    // If we already have a panel, show it.
    if (WebAppPanel.currentPanel) {
      WebAppPanel.currentPanel._panel.reveal(column);
      return;
    }

    // Otherwise, create a new panel.
    const title: string =
      vscode.workspace.getConfiguration().get("legado-vscode.panelTitle") || "阅读";
    const panel = vscode.window.createWebviewPanel(
      WebAppPanel.viewType,
      title,
      column,
      // Extra panel configurations
      {
        // Enable javascript in the webview
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, "out"),
          vscode.Uri.joinPath(extensionUri, "web", "dist")
        ]
      }
    );

    WebAppPanel.currentPanel = new WebAppPanel(panel, extensionUri);
  }

  public static kill() {
    WebAppPanel.currentPanel?.dispose();
    WebAppPanel.currentPanel = undefined;
  }

  public reload() {
    this._panel.webview.html = "";
    setTimeout(() => this._update(), 0);
  }

  public setPanelTitle(title: string) {
    this._panel.title = title;
  }

  public dispose() {
    WebAppPanel.currentPanel = undefined;

    // Clean up our resources
    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private _messageListener(message: any) {
    switch (message.command) {
      case "alert":
        vscode.window.showErrorMessage(message.text);
        return;
      case "setConfiguration":
        vscode.workspace
          .getConfiguration()
          .update(message.key, message.value, vscode.ConfigurationTarget.Global);
        if (message.key === "legado-vscode.panelTitle") {
          WebAppPanel.currentPanel?.setPanelTitle(message.value);
        }
        return;
      case "reload":
        WebAppPanel.currentPanel?.reload();
        return;
      case "close":
        WebAppPanel.kill();
        return;
      case "setStatusBarChapter":
        WebAppPanel._statusBarReader?.setChapter(message.value as StatusBarChapter);
        return;
      case "setStatusBarBook":
        WebAppPanel._statusBarReader?.setBook(message.value as StatusBarBook);
        return;
      case "hideStatusBarContent":
        WebAppPanel._statusBarReader?.hideContent();
        return;
      case "statusBarLoadFailed":
        WebAppPanel._statusBarReader?.setLoadFailed();
        return;
    }
  }

  private async _update() {
    const webview = this._panel.webview;
    this._panel.webview.html = this._getHtmlForWebview(webview);
  }

  private _postColorMode(theme = vscode.window.activeColorTheme) {
    this._panel.webview.postMessage({
      command: "colorMode",
      value: this._getColorMode(theme)
    });
  }

  private _getColorMode(theme = vscode.window.activeColorTheme) {
    return theme.kind === vscode.ColorThemeKind.Dark ||
      theme.kind === vscode.ColorThemeKind.HighContrast
      ? "dark"
      : "light";
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const baseUri = getUri(webview, this._extensionUri, ["web", "dist"]).toString();
    let webServeUrl: string =
      vscode.workspace.getConfiguration().get("legado-vscode.webServeUrl") || "";
    webServeUrl = webServeUrl.replace(/^\s+|[\/\s]+$/, "");
    let panelTitle: string =
      vscode.workspace.getConfiguration().get("legado-vscode.panelTitle") || "阅读";
    panelTitle = panelTitle.replace(/^\s+|\s+$/g, "");
    const statusBarConfiguration = vscode.workspace.getConfiguration(
      "legado-vscode.statusBar"
    );
    const statusBarEnabled = statusBarConfiguration.get<boolean>("enabled", true);
    const statusBarMaxLength = statusBarConfiguration.get<number>("maxLength", 60);
    const statusBarMouseMoveDelay = statusBarConfiguration.get<number>("mouseMoveDelay", 3);
    const statusBarAutoHideSeconds = statusBarConfiguration.get<number>(
      "autoHideSeconds",
      10
    );
    const statusBarWheelEnabled = statusBarConfiguration.get<boolean>("wheelEnabled", true);
    const colorMode = this._getColorMode();

    return /*html*/ `
      <!DOCTYPE html>
      <html lang="zh" class="">
        <head>
          <meta charset="UTF-8" />
          <link rel="icon" href="${baseUri}/favicon.ico" />
          <meta name="viewport" content="width=device-width,initial-scale=1.0" />
          <script type="text/javascript">
            localStorage.setItem("legadoWebServeUrl", ${JSON.stringify(webServeUrl)});
            localStorage.setItem("legadoPanelTitle", ${JSON.stringify(panelTitle)});
            localStorage.setItem("legadoStatusBarEnabled", ${JSON.stringify(
              statusBarEnabled
            )});
            localStorage.setItem("legadoStatusBarMaxLength", ${JSON.stringify(
              statusBarMaxLength
            )});
            localStorage.setItem("legadoStatusBarMouseMoveDelay", ${JSON.stringify(
              statusBarMouseMoveDelay
            )});
            localStorage.setItem("legadoStatusBarAutoHideSeconds", ${JSON.stringify(
              statusBarAutoHideSeconds
            )});
            localStorage.setItem("legadoStatusBarWheelEnabled", ${JSON.stringify(
              statusBarWheelEnabled
            )});
            localStorage.setItem("legadoColorMode", ${JSON.stringify(colorMode)});
          </script>
          <script type="module" crossorigin src="${baseUri}/assets/index.js"></script>
          <link rel="modulepreload" crossorigin href="${baseUri}/assets/vendor.js">
          <link rel="stylesheet" href="${baseUri}/assets/vendor.css">
          <link rel="stylesheet" href="${baseUri}/assets/index.css">
        </head>
        <body>
          <div id="app"></div>
        </body>
      </html>
    `;
  }
}
