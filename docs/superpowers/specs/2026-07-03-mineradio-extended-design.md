# Mineradio 扩展版第一阶段设计

## 目标

新建一个独立 GitHub 仓库，专门承载长期二创、扩展和改编版本。

第一阶段仓库名使用 `Mineradio-Extended`，中文名使用 `Mineradio 扩展版`。这个阶段的重点是建立稳定仓库入口和下载入口，让用户不用每次都找新的发布链接。

现有 `Mineradio-kugou` 继续作为给原作者提交 PR 的 fork 仓库，不承担长期二创主仓库职责。

第一阶段是独立二创仓库的身份和分发方式整理，不是新增音源开发阶段。

## 定位

`Mineradio-Extended` 是基于 `XxHuberrr/Mineradio` 的非官方改编仓库。

这里的“独立仓库”表示它不作为 GitHub UI 里的 fork 仓库继续服务 PR，而是作为用户公开访问的二创主仓库。它仍然必须保留原项目来源、原作者署名、GPL-3.0 授权和修改说明。

README 和 Release 说明必须明确写清楚：

- 本项目基于原版 Mineradio。
- 保留原作者署名、原项目链接和 GPL-3.0 授权说明。
- 本仓库不是 Mineradio 官方版本。
- 本仓库用于在上游合并前或上游之外提供实验性音源和体验扩展。
- 当前已经稳定接入的扩展是酷狗概念版音源。

不要使用 `Plus`、`Pro`、`官方增强版`、`高级版` 等容易暗示“比原版更高级”或“被原作者官方认可”的说法。

## 第一阶段包含什么

第一阶段 `Mineradio-Extended` 包含当前已经验证过的酷狗概念版能力：

- 酷狗概念版扫码登录。
- 酷狗概念版搜索和播放地址获取。
- 酷狗概念版个人歌单和歌单歌曲加载。
- 酷狗概念版新建歌单和收藏到歌单。
- 酷狗概念版红心喜欢链路。
- 酷狗概念版歌词。
- 酷狗概念版歌曲评论，并显示在歌曲详情弹窗里。
- 底部播放器新增 `歌曲详情 / 评论` 显式入口。
- 酷狗大歌单详情默认拉取数量从 200 提高到 500。
- Windows 安装包桌面快捷方式修复。

## 第一阶段暂时不做什么

第一阶段不实现：

- 普通酷狗音源。
- 汽水音乐音源。
- 其他新音源。
- 大改 `此处施工，敬请期待` 首页区域。
- 新增 DIY 视觉控制。
- 去掉原作者署名或把项目包装成官方版本。

这些内容可以作为后续阶段单独设计、单独验证，不混进第一阶段。

## 仓库和下载策略

新建独立仓库 `daaimengermengzhu/Mineradio-Extended`。

保留现有仓库 `daaimengermengzhu/Mineradio-kugou`：

- 继续作为 `XxHuberrr/Mineradio` 的 PR 来源仓库。
- 保留 PR #204 的提交历史和上游同步关系。
- 不再作为对外宣传的二创主入口。

推荐以后公开发给用户的入口：

- 仓库主页：`https://github.com/daaimengermengzhu/Mineradio-Extended`
- 固定最新版下载页：`https://github.com/daaimengermengzhu/Mineradio-Extended/releases/latest`

`/releases/latest` 是 GitHub 的固定最新版入口。以后每次发新版本，只要把最新 Release 标记为最新，用户点同一个链接就能到最新下载页。

README 要告诉普通用户只下载安装包，不要下载 `Source code`、`.blockmap` 或 `latest.yml`。

上游 PR 继续保留并与二创仓库解耦：

- 上游 PR：`https://github.com/XxHuberrr/Mineradio/pull/204`

二创仓库负责给急用用户提供可安装版本；PR 继续作为向原作者回馈代码的正式通道。

实现时可以从当前已验证代码创建独立仓库，但对外说明不能抹掉原项目来源。用户看到的是一个长期二创主仓库，而不是临时 PR fork。

## 文档改动范围

第一阶段实现时需要更新：

- `README.md`
- 必要时更新 `NOTICE.md`
- 当前预览 Release 的说明
- 新 GitHub 仓库简介和 About 信息

README 顶部应包含：

1. 项目名：`Mineradio 扩展版`
2. 非官方 fork 声明。
3. 原项目署名和链接。
4. 固定最新版安装包下载入口。
5. 当前相对原版新增的功能。
6. 后续兼容性取决于原项目和本 fork 后续维护的说明。

## 验证方式

发布第一阶段版本前需要验证：

- `git diff --check`
- `node --check server.js`
- 前端内联脚本解析检查
- 现有酷狗验证脚本
- `npm run build:win`
- 确认生成的安装包来自当前源码
- 确认新仓库 Release 页面使用固定 latest 下载入口

## 风险

新建独立仓库会产生两个公开仓库：`Mineradio-kugou` 和 `Mineradio-Extended`。需要在 README 和 Release 里解释清楚二者区别，避免用户把 PR fork 当成长期二创主仓库。

`Mineradio-kugou` 继续服务上游 PR；`Mineradio-Extended` 承载你的长期二创资产和发布入口。

原项目 README 已说明 Mineradio 名称、MR Logo、界面视觉设计与原创视觉表达归原作者所有。二创版必须保留清晰署名，不能表现成官方版。

因为原项目采用 GPL-3.0，二创版对外分发时也必须继续开源并保留 GPL-3.0。你的新增代码、文档、配置和二创功能可以作为你的贡献资产记录在仓库中，但不能把基于原 GPL 项目的整体分发改成闭源或私有授权。

普通酷狗、汽水音乐等新音源可能涉及接口稳定性、账号权限、版权和平台服务条款风险。后续接入前需要单独调研和设计。

## 后续阶段候选

第一阶段稳定后，再考虑：

1. 设计并替换 `此处施工，敬请期待` 首页区域。
2. 设计新的 DIY 视觉控制。
3. 调研普通酷狗音源。
4. 调研汽水音乐音源。
5. 判断后续音源是否继续写成独立路由，还是抽象成统一 source provider 结构。
