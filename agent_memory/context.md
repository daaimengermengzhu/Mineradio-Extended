# 项目上下文

## 项目目标

- 在 Mineradio fork 上逐步加入酷狗概念版能力，优先完成登录、搜索、播放地址、个人歌单和歌单播放链路。

## 架构与约定

- 项目是 Electron + Node.js 本地播放器。
- 后端入口是 `server.js`，本地 HTTP 服务为前端提供音乐平台接口。
- 前端主界面集中在 `public/index.html`。
- 酷狗概念版登录态保存在本地 `.kugou-cookie`，该文件必须保持 Git 忽略，不能提交。

## 关键路径

- `server.js`
- `public/index.html`
- `docs/KUGOU_CONCEPT_INTERFACE_NOTES.md`
- `scripts/verify-kugou-login-ui.js`
- `scripts/verify-kugou-search-playback.js`
- `scripts/verify-kugou-playlists-priority.js`

## 当前有效假设

- 用户已经能通过酷狗概念版二维码扫码登录。
- 酷狗搜索、播放地址、个人歌单列表、歌单歌曲列表已经接入当前本地版本。
- 当前播放鉴权验证能在登录态下返回可播放 URL；个别歌曲仍可能受会员、付费、版权、地区或官方客户端策略影响。
