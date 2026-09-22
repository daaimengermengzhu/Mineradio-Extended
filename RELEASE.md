# 维护者发布备忘

这份文档面向仓库维护者，用于记录打包和发布前检查。普通用户下载安装包时，只需要阅读 README 和 GitHub Release 页面。

## 当前发布边界

本次发布版本是 `v1.1.4` 扩展版预览，标签沿用 `v1.1.4-extended.1` 格式。

本仓库是非官方二创版本，Release 文案必须同时说明：

- 原项目来自 [XxHuberrr/Mineradio](https://github.com/XxHuberrr/Mineradio)。
- 本仓库不是原作者官方版本。
- 扩展版提供酷狗概念版、普通酷狗音乐、汽水音乐预览接入、Home 个性化和 DIY 视觉能力；区分已有功能与本版本新增内容。
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
- 文档没有承诺尚未实现的酷狗官方音效、汽水会员完整播放、汽水收藏写入或评论发布。扫码登录和官方网页音频已接通，部分歌曲仍仅提供试听。

## 必跑验证

```powershell
node scripts\verify-shape-preset-wiring.js
node --test tests/*.test.js test/lyrics/*.test.js test/equalizer/*.test.js test/custom-source/*.test.js
node --check server.js
git diff --check
```

如果修改了安装包或桌面主进程，还需要运行：

```powershell
npm run build:win
```

构建产物位于 `dist/`。正式给普通用户分发时，以 `Mineradio-1.1.4-Setup.exe` 这类完整安装包为准，不要让普通用户下载 `Source code`、`.blockmap`、`latest.yml` 或 `win-unpacked`。

### 汽水原生播放验证

调整汽水播放链路后，应验证实际音频来自汽水，而不只是搜索结果标记为 `QS`。可用 `tests/qishui-native-only-server.js` 进行手动验证：将环境变量 `QISHUI_QR_CONFIG_FILE` 指向本机已有登录文件，再运行该脚本并打开它打印的本机地址。脚本仅加载汽水接口，不加载其他平台实现或凭证；其他平台 API 会被拒绝。

播放后检查音频时间推进、实际时长、试听提示，以及 `/__test/provenance` 中的歌曲 ID、上游域名和音频请求记录。测试完停止服务，不要上传登录文件或带凭证的调试信息。正常客户端仍保留失败后尝试其他平台的换源逻辑，不能把这项隔离测试描述成“所有汽水歌曲永不换源”。

v1.1.4 已完成免费整曲和试听片段的原生播放验证，包括作者发布时标注汽水独家的 AnliD《The Unfinished Song（慵懒版）》；该曲实测返回约 30 秒试听。个人歌单内容完整性仍待核对，会员整曲不在已验证能力内。

## GitHub Release 建议文案

Release 标题可以使用：

```text
Mineradio v1.1.4 扩展版预览
```

Release 正文建议包含：

- 本版本是非官方二创扩展版。
- 修复歌单默认倒序，提供“平台顺序”和“反向顺序”，详情、3D 歌单架和整单播放保持一致。
- 修复酷狗部分歌曲歌手、专辑和封面显示，补齐喜欢歌单和无封面歌单的默认图。
- 从原版移植月蚀圣环、雨幕霓虹、折光蝶群、深海绽放，内置预设从 7 款增至 11 款。
- 新增 30 帧、60 帧、跟随屏幕的前台帧率选项，优化隐藏窗口绘制与汽水音频缓存占用。
- 汽水音乐支持抖音扫码登录、搜索、歌单读取和分享导入；官方网页通道可播放免费完整歌曲，会员歌以平台实际返回的试听为准，不承诺会员完整播放。
- 汽水原生播放已在禁用其他平台的环境下验证；说明试听限制、个人歌单内容待核对，以及正常客户端仍可能显示换源提示。
- 本次通过 141 项自动化测试，并验证打包后的二维码生成、轮询、取消和搜索。
- 本版本不包含二创作者个人实验形态。
- 下载时请只下载 `Mineradio-1.1.4-Setup.exe`。

十段均衡器、歌词下一句预览、第三方音源脚本和 DIY 工坊属于已有能力，不应再次写成 v1.1.4 新增功能。完整变更以 [CHANGELOG](./CHANGELOG.md) 为准。

建议上传资产：

- `dist/Mineradio-1.1.4-Setup.exe`
- `dist/Mineradio-1.1.4-Setup.exe.blockmap`
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

然后使用 `dist/Mineradio-1.1.4-Setup.exe` 安装，或直接运行 `dist/win-unpacked/Mineradio.exe` 做本地验证。

如果要替换本机正在用的安装版，建议通过安装包覆盖安装，而不是手动复制零散文件，避免 `resources/app`、桌面快捷方式和卸载信息不一致。
