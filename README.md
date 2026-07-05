# Mineradio 扩展版

![Mineradio 暗场启动页](./docs/assets/readme/cinema-beat-smoke.png)

> 非官方二创 Fork，基于 [XxHuberrr/Mineradio](https://github.com/XxHuberrr/Mineradio)。
> 本仓库用于在尊重原作者和 GPL-3.0 授权的前提下，维护更多音源、歌单导入和个性化体验扩展。

Mineradio 扩展版是一款 Windows 桌面沉浸式音乐播放器。原版 Mineradio 已经提供天气电台、搜索播放、歌词舞台、粒子视觉和 3D 歌单架；本扩展版在此基础上补充酷狗概念版、普通酷狗音乐、汽水音乐歌单导入、个性化 Home 面板和更自由的 DIY 视觉工坊。

## 和原版的关系

- 原项目：[`XxHuberrr/Mineradio`](https://github.com/XxHuberrr/Mineradio)
- 本仓库不是 Mineradio 官方版本，也不代表原作者发布。
- 原作者与原项目贡献必须保留署名。
- 酷狗概念版接入已经通过 PR 回馈上游：[`XxHuberrr/Mineradio#204`](https://github.com/XxHuberrr/Mineradio/pull/204)
- `daaimengermengzhu/Mineradio-kugou` 只作为上游 PR 来源仓库；本仓库 `Mineradio-Extended` 是后续二创扩展主仓库。

## 下载

普通用户请进入最新版 Release，只下载安装包：

[下载 Mineradio 扩展版最新版](https://github.com/daaimengermengzhu/Mineradio-Extended/releases/latest)

请下载文件名类似下面的安装包：

```text
Mineradio-1.1.1-Setup.exe
```

不要下载这些文件：

- `Source code`：这是源码压缩包，不是普通用户安装包。
- `.blockmap`：这是自动更新用的差异文件，不是安装包。
- `latest.yml`：这是更新配置文件，不是安装包。
- `win-unpacked`：这是打包目录，不建议当作正式安装包分发。

安装包会创建桌面快捷方式。直接运行打包目录里的 `Mineradio.exe` 时，应用也会在首次启动时尝试补创建桌面快捷方式。

## 当前公开扩展

| 模块 | 当前状态 |
| --- | --- |
| 酷狗概念版 | 支持扫码登录、搜索、播放、个人歌单、歌单详情、红心、新建歌单、收藏到歌单、歌词和评论。 |
| 普通酷狗音乐 | 支持扫码登录、搜索、播放、个人歌单、歌单详情、红心、新建歌单、收藏到歌单、歌词和评论。 |
| 酷狗音质 | 酷狗概念版和普通酷狗音乐统一显示 `Hi-Res音质`、`无损音质`、`高品音质`、`标准音质` 四档，并按实际返回码率校正展示。 |
| 汽水音乐 | 支持粘贴分享歌单链接并生成本地“汽水音乐歌单”。汽水自身音源不可直接播放时，会尝试换源到其它可用平台。 |
| 我的歌单 | 歌单详情支持按收藏时间、歌手名、本地播放次数等方式查看。 |
| Home 个性化 | 左侧“我的音乐海报”支持换本地图片、使用当前封面、页面内编辑文案和重置。 |
| DIY 视觉 | 新增“我的作品”和“形态工坊”，支持用点、线、环、曲线环、螺旋等基础粒子创建本地自定义形态，导入/导出 `.mineradio-visual.json` 和 `.mineradio-shape.json`。 |
| 安装体验 | 修复桌面快捷方式和安装包目录安全策略。 |

更完整的普通用户教程见：[使用教程](./docs/USAGE_GUIDE.md)

## 重要边界

- 本扩展版不会绕过付费、绕过会员、破解音质或重新分发音乐内容。
- 第三方平台接入只用于个人学习、本地客户端体验和用户自有账号的播放辅助。
- 汽水音乐目前重点是歌单导入；如果汽水返回的是浏览器不能直接解码的加密音频，播放器会按现有策略尝试换源。
- 酷狗官方音效暂未接入；界面里的“动态/律动”属于视觉效果，不等于酷狗官方音效。
- DIY 形态工坊是公开功能，但不会内置二创作者的个人实验形态；用户可以自己创建、保存、导入和导出形态。

## 下载或安装被拦截怎么办

小众 Electron 桌面软件、未签名安装包有时会被浏览器、Windows Defender 或 SmartScreen 提示风险。请先确认安装包来自本仓库 GitHub Release。

1. 浏览器下载栏提示风险时，打开下载列表，点这条下载右侧的 `...`，选择 `保留` / `仍要保留` / `显示更多` 后继续保留。
2. Windows SmartScreen 弹出蓝色拦截窗口时，点 `更多信息`，再点 `仍要运行`。
3. 如果杀毒软件明确显示木马、高危或已经隔离，不要强行运行；请删除该文件后重新从 GitHub Release 下载，仍然异常请带截图反馈。

## 开发运行

```bash
npm install
npm start
npm run build:win
```

桌面版入口由 Electron 主进程加载本地服务。`npm run build:win` 会生成 Windows NSIS 安装包，产物位于 `dist/`。

## 更新机制

Mineradio 会请求 GitHub Releases latest 检测新版本。远端版本高于本地版本时，应用内更新入口会展示 Release 内容、下载安装包到本机用户数据目录，并通过系统打开安装包。

本地验证更新链路时，可以通过 `MINERADIO_UPDATE_MANIFEST` 指向一个本地 manifest JSON 或 HTTP 地址来模拟线上 Release。

## 支持渠道

本仓库是非官方二创 Fork。原作者支持渠道和二创作者支持渠道分开展示，扫码前请确认收款人信息。

[查看完整支持页](./docs/SUPPORT.md)

### 原作者支持渠道

如果原版 Mineradio 陪你多听了一首歌，也欢迎通过原作者支持渠道支持原作者。

<img src="./docs/assets/support/mineradio-author-support-poster.png" alt="Mineradio 原作者支持渠道" width="360">

### 二创作者支持渠道

如果扩展版的酷狗概念版、普通酷狗、汽水歌单导入或个性化功能帮到了你，也可以通过二创作者支持渠道支持后续维护。

<img src="./docs/assets/support/extended-author-wechat-pay.png" alt="Mineradio 扩展版二创作者支持渠道" width="360">

## 用户数据与隐私

登录 Cookie、搜索历史、自定义封面、自定义歌词、节奏分析缓存、汽水本地凭证和自定义视觉作品等数据只应保存在本机用户数据目录或浏览器本地存储中，不应提交到仓库。

更多说明见 [PRIVACY.md](./PRIVACY.md)。

## 致谢

Mineradio 由 XxHuberrr 主要设计与打造。emily 作为早期视觉底层想法与 `emily` 视觉预设改进方向的共创者和灵感来源之一，特此感谢。

同时感谢小天才e宝、应春日、锋将军、軌跡、林中、骊、风痕、花椰菜🥦在早期体验、测试反馈和发布准备中的帮助。

## 版权与授权

Copyright (C) 2026 XxHuberrr.

本项目采用 GPL-3.0 授权。详见 [LICENSE](./LICENSE)。

MR Logo、Mineradio 名称、界面视觉设计与原创视觉表达归作者所有；第三方依赖和第三方服务分别遵循其各自授权与服务条款。
