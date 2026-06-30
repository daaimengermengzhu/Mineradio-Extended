# 当前任务进展

## 任务目标

- 在已完成酷狗概念版扫码登录的基础上，修复“显示已登录但歌单未接入、播放像非登录态”的体验问题。

## 当前阶段

- 已接入酷狗个人歌单和歌单歌曲列表。
- 已提高酷狗已登录时综合搜索里 KG 结果的排序权重，降低误点网易云或 QQ 结果的概率。
- 本地服务已重启，运行在 `http://127.0.0.1:3000`。

## 已完成

- fork 并克隆原版 Mineradio。
- 添加酷狗概念版登录后端路由和登录 UI。
- 添加 `/api/kugou/search` 和 `/api/kugou/song/url`。
- 前端 `All` 搜索合并网易云、QQ、酷狗结果，并新增 `KG` 搜索模式。
- 添加 `/api/kugou/user/playlists` 和 `/api/kugou/playlist/tracks`。
- 前端个人歌单列表、歌单详情、歌单播放队列、3D 歌单架均已支持酷狗歌单。

## 下一步

- 若用户反馈某一首歌仍提示无权限，需要记录具体歌名、来源标签和播放品质，再继续定位酷狗单曲权限接口。
- 后续可继续接酷狗歌词、红心、收藏到歌单、会员详情等账号库能力。

## 验证记录

- `node --check server.js` 通过，后端语法正常。
- `node scripts\verify-kugou-login-ui.js` 通过。
- `node scripts\verify-kugou-search-playback.js` 通过。
- `node scripts\verify-kugou-playlists-priority.js` 通过。
- `git diff --check` 通过，未发现空白格式问题。
- 浏览器检查通过：酷狗已登录，前端拿到 4 个酷狗歌单，页面有 4 张酷狗歌单卡片，无 console error。
- 真实接口验证：`/api/kugou/user/playlists` 返回 4 个歌单；其中第 2 和第 4 个歌单能返回酷狗歌曲。
- 真实播放验证：从酷狗歌单取到的歌曲调用 `/api/kugou/song/url` 返回 `loggedIn=true`、`playable=true`、`hasUrl=true`。
