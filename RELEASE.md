# 发布流程

## 当前发布边界

当前公开版本是 `v1.1.1` 扩展版预览。

本仓库是非官方二创 Fork，Release 文案必须同时说明：

- 原项目来自 [XxHuberrr/Mineradio](https://github.com/XxHuberrr/Mineradio)。
- 本仓库不是原作者官方版本。
- 扩展版新增酷狗概念版、普通酷狗音乐、汽水歌单导入、Home 个性化和 DIY 视觉能力。
- 项目不会绕过付费、绕过会员、破解音质或重新分发音乐内容。
- 公开版不内置二创作者个人实验形态；DIY 形态由用户自己创建、保存或导入。

## 发布前检查

提交或打包前至少确认：

- `package.json` 和 `package-lock.json` 版本号一致。
- `mineradio.update.owner/repo` 指向 `daaimengermengzhu/Mineradio-Extended`。
- `.cookie`、`.qq-cookie`、`.kugou-cookie`、`.kugou-music-cookie`、汽水本地凭证、`node_modules/`、旧 `dist/` 没有进入 Git。
- README、CHANGELOG、使用教程和 Release 正文没有把个人实验形态写成公开功能。
- README 中普通用户下载入口指向 GitHub latest release。
- 支持渠道清楚区分“原作者支持渠道”和“二创作者支持渠道”。
- 文档没有承诺尚未实现的酷狗官方音效、汽水完整账号登录或汽水会员直连播放。

## 必跑验证

```powershell
node scripts\verify-shape-preset-wiring.js
node --check server.js
git diff --check
```

如果修改了安装包或桌面主进程，还需要运行：

```powershell
npm run build:win
```

构建产物位于 `dist/`。正式给普通用户分发时，以 `Mineradio-1.1.1-Setup.exe` 这类完整安装包为准，不要让普通用户下载 `Source code`、`.blockmap`、`latest.yml` 或 `win-unpacked`。

## GitHub Release 建议文案

Release 标题可以使用：

```text
Mineradio v1.1.1 扩展版预览
```

Release 正文建议包含：

- 本版本是非官方二创扩展版。
- 酷狗概念版和普通酷狗音乐新增登录、播放、歌单、红心、收藏、歌词、评论等能力。
- 汽水音乐当前支持分享歌单导入；直接播放仍受平台返回音频格式影响，不承诺完整会员直连播放。
- DIY 视觉增加“我的作品”和“形态工坊”，支持用户用点、线、环、曲线环、螺旋等基础粒子自己创建、导入、导出形态。
- 本版本不包含二创作者个人实验形态。
- 下载时请只下载 `Mineradio-1.1.1-Setup.exe`。

建议上传资产：

- `dist/Mineradio-1.1.1-Setup.exe`
- `dist/Mineradio-1.1.1-Setup.exe.blockmap`
- `dist/latest.yml`

不要上传：

- 本地 cookie、登录凭证、个人配置。
- 未验证来源的旧安装包。
- 包含个人实验内容的测试包。

## 本地安装包同步

如果只是在本机验证当前代码，可以先构建本地 EXE 包：

```powershell
npm run build:win
```

然后使用 `dist/Mineradio-1.1.1-Setup.exe` 安装，或直接运行 `dist/win-unpacked/Mineradio.exe` 做本地验证。

如果要替换本机正在用的安装版，建议通过安装包覆盖安装，而不是手动复制零散文件，避免 `resources/app`、桌面快捷方式和卸载信息不一致。
