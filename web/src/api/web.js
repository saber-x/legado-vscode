import axios from "axios";

const vscode =
  typeof window.acquireVsCodeApi === "function" ? window.acquireVsCodeApi() : undefined;

const isVscode = () => !!vscode;

const getPanelTitle = () => {
  return localStorage.getItem("legadoPanelTitle") || document.title || "阅读";
};

const setPanelTitle = (title) => {
  localStorage.setItem("legadoPanelTitle", title);
  document.title = title;
  if (vscode) {
    vscode.postMessage({
      command: "setConfiguration",
      key: "legado-vscode.panelTitle",
      value: title
    });
  }
};

const getLegadoWebServeUrl = () => {
  let legadoWebServeUrl = localStorage.getItem("legadoWebServeUrl");
  return legadoWebServeUrl || import.meta.env.VITE_API || location.origin;
};

const setLegadoWebServeUrl = (url) => {
  localStorage.setItem("legadoWebServeUrl", url);
  if (vscode) {
    vscode.postMessage({
      command: "setConfiguration",
      key: "legado-vscode.webServeUrl",
      value: url
    });
  }
};

const getStatusBarMaxLength = () => {
  const value = Number(localStorage.getItem("legadoStatusBarMaxLength"));
  return Number.isInteger(value) && value >= 20 && value <= 200 ? value : 60;
};

const setStatusBarMaxLength = (value) => {
  localStorage.setItem("legadoStatusBarMaxLength", String(value));
  if (vscode) {
    vscode.postMessage({
      command: "setConfiguration",
      key: "legado-vscode.statusBar.maxLength",
      value
    });
  }
};

const getStatusBarEnabled = () => {
  return localStorage.getItem("legadoStatusBarEnabled") !== "false";
};

const setStatusBarEnabled = (value) => {
  localStorage.setItem("legadoStatusBarEnabled", String(value));
  vscode?.postMessage({
    command: "setConfiguration",
    key: "legado-vscode.statusBar.enabled",
    value
  });
};

const getStatusBarMouseMoveDelay = () => {
  const value = Number(localStorage.getItem("legadoStatusBarMouseMoveDelay"));
  return Number.isInteger(value) && value >= 0 && value <= 60 ? value : 3;
};

const setStatusBarMouseMoveDelay = (value) => {
  localStorage.setItem("legadoStatusBarMouseMoveDelay", String(value));
  vscode?.postMessage({
    command: "setConfiguration",
    key: "legado-vscode.statusBar.mouseMoveDelay",
    value
  });
};

const getStatusBarAutoHideSeconds = () => {
  const value = Number(localStorage.getItem("legadoStatusBarAutoHideSeconds"));
  return Number.isInteger(value) && value >= 0 && value <= 600 ? value : 10;
};

const setStatusBarAutoHideSeconds = (value) => {
  localStorage.setItem("legadoStatusBarAutoHideSeconds", String(value));
  vscode?.postMessage({
    command: "setConfiguration",
    key: "legado-vscode.statusBar.autoHideSeconds",
    value
  });
};

const getStatusBarWheelEnabled = () => {
  return localStorage.getItem("legadoStatusBarWheelEnabled") !== "false";
};

const setStatusBarWheelEnabled = (value) => {
  localStorage.setItem("legadoStatusBarWheelEnabled", String(value));
  vscode?.postMessage({
    command: "setConfiguration",
    key: "legado-vscode.statusBar.wheelEnabled",
    value
  });
};

const checkLegadoWebServeUrl = (url) => {
  return axios
    .create({
      baseURL: url,
      timeout: 3000
    })
    .get("/getBookshelf");
};

const reload = () => {
  if (vscode) {
    vscode.postMessage({
      command: "reload"
    });
  } else {
    location.reload();
  }
};

const closePanel = () => {
  if (vscode) {
    vscode.postMessage({
      command: "close"
    });
  } else {
    window.close();
  }
};

const setStatusBarChapter = (chapter) => {
  vscode?.postMessage({
    command: "setStatusBarChapter",
    value: chapter
  });
};

const setStatusBarBook = (book) => {
  vscode?.postMessage({
    command: "setStatusBarBook",
    value: book
  });
};

const hideStatusBarContent = () => {
  vscode?.postMessage({ command: "hideStatusBarContent" });
};

const statusBarLoadFailed = () => {
  vscode?.postMessage({ command: "statusBarLoadFailed" });
};

export default {
  isVscode,
  getPanelTitle,
  setPanelTitle,
  getLegadoWebServeUrl,
  setLegadoWebServeUrl,
  getStatusBarMaxLength,
  setStatusBarMaxLength,
  getStatusBarEnabled,
  setStatusBarEnabled,
  getStatusBarMouseMoveDelay,
  setStatusBarMouseMoveDelay,
  getStatusBarAutoHideSeconds,
  setStatusBarAutoHideSeconds,
  getStatusBarWheelEnabled,
  setStatusBarWheelEnabled,
  checkLegadoWebServeUrl,
  reload,
  closePanel,
  setStatusBarChapter,
  setStatusBarBook,
  hideStatusBarContent,
  statusBarLoadFailed
};
