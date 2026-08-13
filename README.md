# 阅读VS Code插件

[![Visual Studio Marketplace Version](https://badgen.net/vs-marketplace/v/sunrishe.legado-vscode)](https://marketplace.visualstudio.com/items?itemName=sunrishe.legado-vscode)
[![Visual Studio Marketplace Downloads](https://badgen.net/vs-marketplace/d/sunrishe.legado-vscode)](https://marketplace.visualstudio.com/items?itemName=sunrishe.legado-vscode)
[![stars](https://badgen.net/github/stars/saber-x/legado-vscode)](https://github.com/saber-x/legado-vscode)
[![issues](https://badgen.net/github/open-issues/saber-x/legado-vscode)](https://github.com/saber-x/legado-vscode/issues)
[![PRs](https://badgen.net/github/open-prs/saber-x/legado-vscode)](https://github.com/saber-x/legado-vscode/pulls)
[![GitHub License](https://badgen.net/github/license/saber-x/legado-vscode)](https://github.com/saber-x/legado-vscode)

📕 [GitHub仓库](https://github.com/saber-x/legado-vscode)
📗 [VS Code插件市场](https://marketplace.visualstudio.com/items?itemName=sunrishe.legado-vscode)
📘 [更新日志](https://github.com/saber-x/legado-vscode/blob/main/CHANGELOG.md)

📙 插件不断完善，欢迎提交 [Issues](https://github.com/saber-x/legado-vscode/issues)、[Pull requests](https://github.com/saber-x/legado-vscode/pulls)

---

## 功能

> 配合[阅读APP](https://github.com/LegadoTeam/legado.git)用来学习的阅读插件，并在阅读APP的WEB服务基础上，书架页面增加了暗黑模式，章节阅读页面增加 <kbd>W</kbd> <kbd>S</kbd> <kbd>A</kbd> <kbd>D</kbd> 进行翻页控制。
>
> 😎悄悄地告诉你，阅读界面打开`无限加载`食用更佳哦~

### 状态栏阅读

VS Code 启动后，底部状态栏会立即显示书本图标，并从阅读 APP 书架自动加载最近阅读的书，无需先打开阅读标签页。鼠标单击图标后显示正文；如果书架、目录或章节获取失败，图标仍会保留，单击后执行 `阅读APP Legado: 打开阅读APP书架`。在 macOS 上，显示正文或翻页 3 秒后开始检测鼠标，之后移动鼠标会立即隐藏正文并恢复为书本图标。正文显示时，滚轮向上显示上一段，向下显示下一段。静止鼠标时，连续 10 秒没有翻页或单击操作也会自动隐藏。关闭阅读标签页后仍可继续翻页和切换章节。

macOS 首次使用滚轮翻页时，需要按扩展提示开启“系统设置 → 隐私与安全性 → 输入监控”中的 Visual Studio Code 权限，然后完全退出并重新打开 VS Code。

书架页面的“基本设定”中可配置状态栏开关、每段最大字符数、鼠标移动监听延迟、无操作自动隐藏时间和滚轮翻页开关，保存后立即生效。

状态栏获得焦点并显示正文时，支持以下按键：

- <kbd>W</kbd>、<kbd>A</kbd>、<kbd>↑</kbd>、<kbd>←</kbd>、<kbd>PgUp</kbd>：上一段
- <kbd>S</kbd>、<kbd>D</kbd>、<kbd>↓</kbd>、<kbd>→</kbd>、<kbd>PgDn</kbd>：下一段
- <kbd>空格</kbd>：快速隐藏或显示正文
- <kbd>Esc</kbd>：隐藏正文并退出状态栏焦点

也可以在命令面板执行以下命令：

- `阅读APP Legado: 状态栏显示上一段`
- `阅读APP Legado: 状态栏显示下一段`
- `阅读APP Legado: 显示或隐藏状态栏阅读`
- `阅读APP Legado: 快速隐藏或显示状态栏正文`

设置项 `legado-vscode.statusBar.maxLength` 可调整每段最多显示的字符数，默认是 60。

### 书架页面

点击基本设定下的状态栏，可以设置阅读APP的WEB服务访问地址。

### 快捷键

#### 书架页面

<kbd>R</kbd> 刷新页面

<kbd>X</kbd> 关闭页面

#### 阅读页面

<kbd>Q</kbd> 返回书架

<kbd>E</kbd> 打开/关闭章节列表

<kbd>R</kbd> 刷新页面

<kbd>X</kbd> 关闭页面

<kbd>W</kbd>或<kbd>↑</kbd>或<kbd>PgUp</kbd> 向上翻页

<kbd>S</kbd>或<kbd>↓</kbd>或<kbd>PgDn</kbd>或<kbd>空格</kbd> 向下翻页

<kbd>A</kbd>或<kbd>←</kbd> 上一章

<kbd>D</kbd>或<kbd>→</kbd> 下一章

## 使用帮助

1. 在阅读APP中打开`我的 > Web服务`启用Web服务
2. 电脑和手机处于同一局域网内
3. 在VS Code中搜索插件并安装
4. VS Code搜索命令`阅读APP Legado: 打开阅读APP书架`并执行
5. 点击`基本设定下的状态栏`，在弹框中输入阅读APP的WEB服务访问地址
6. 测试成功后自动配置，同步修改VS Code设置`legado-vscode.webServeUrl`阅读APP的WEB服务访问地址的配置信息
7. 页面自动刷新，配置生效

### 启用暗黑模式

1. 打开阅读书架
2. 选择一本书籍进入阅读
3. 阅读页面单击，选择顶部的`设置`
4. 在`阅读主题`中选择暗黑主题
5. 书架和阅读页面同步切换至暗黑主题

### 快速关闭窗口

使用VS Code的`关闭编辑器`命令即可，对应的快捷键一般为<kbd>Ctrl</kbd> + <kbd>W</kbd>。

### 快速打开阅读书架

喜欢使用快捷键高效学习的童鞋，可以自行配置快捷键，一键直达，纵享丝滑。

## 鸣谢

首次接触VS Code插件开发，非常感谢他们对我的帮助。

[gedoor/legado](https://github.com/gedoor/legado.git)
[LegadoTeam/legado](https://github.com/LegadoTeam/legado.git)
[微软官方](https://github.com/microsoft/vscode-webview-ui-toolkit-samples.git)
[CODE Magazine](https://www.codemag.com/article/2107071)
[Mhdi-kr/vscode-webvue](https://github.com/Mhdi-kr/vscode-webvue.git)
[jeege/vscode-reader](https://github.com/jeege/vscode-reader.git)
[aooiuu/z-reader](https://github.com/aooiuu/z-reader.git)
