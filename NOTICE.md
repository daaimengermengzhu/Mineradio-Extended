# NOTICE

Mineradio 使用了以下第三方项目或服务。各项目版权归其原作者所有。

## Fork Notice

Mineradio 扩展版是基于 `XxHuberrr/Mineradio` 的非官方二创 Fork。

原版 Mineradio 的作者、项目来源、界面视觉设计、名称与相关原创表达必须保留署名。本仓库新增的扩展能力、文档和后续二创改动由本仓库维护者继续记录和维护。

本仓库不是 Mineradio 官方版本，也不代表原作者发布。请优先参考原项目了解官方版本：

https://github.com/XxHuberrr/Mineradio

## Third-party Libraries

- Electron
- Three.js
- GSAP
- music-tempo
- NeteaseCloudMusicApi
- mpg123-decoder
- node-qrcode (MIT)

## 2026-09-22 上游能力移植

- 月蚀圣环、雨幕霓虹、折光蝶群、深海绽放四个视觉预设，以及汽水目录/歌单/歌词/播放适配与音频解码模块，移植自 [XxHuberrr/Mineradio-paused](https://github.com/XxHuberrr/Mineradio-paused)，提交 `d43de565acabfdc1a9c9820a27e81a98ccbebcef`，沿用 GPL-3.0。
- 汽水 Passport 扫码桥接来自 [Wx2yZx/Mineradio-Qishui-QR-Login](https://github.com/Wx2yZx/Mineradio-Qishui-QR-Login)，原始提交 `aaadaab7d011714f94fbe45b382ba8dcc7cf17b9`，GPL-3.0-only。保留上游署名与安全组件来源标注。
- `qishui-auth-v6` 中的 React / ReactDOM 沿用文件内 MIT 许可声明；汽水官方登录安全组件保留其原有归属。适配代码的许可不改变第三方组件的权利。
- 扩展版新增本地账号界面适配、短期音频票据、单曲缓存上限、后台休眠及歌单修复，包含于 v1.1.4。

## Custom Source Compatibility References

- [LX Music Desktop](https://github.com/lyswhut/lx-music-desktop)：落雪自定义音源 API 2.0.0 协议与公开运行方式参考。
- [Mineradio-LX](https://github.com/lidonghaofirst/Mineradio-LX)：Mineradio 与落雪自定义音源的模块化适配思路参考。

上述项目均采用 GPL-3.0 授权。本仓库只实现兼容层，不附带、不推荐，也不自动下载任何真实第三方音源脚本。

## Third-party Services

Mineradio 可能与网易云音乐、QQ 音乐等第三方音乐服务进行用户自有账号相关的本地客户端交互。

Mineradio 不是任何音乐平台的官方客户端，也不隶属于网易云音乐、QQ 音乐或腾讯音乐娱乐集团。请用户自行遵守对应平台的服务协议、版权规则和会员权益规则。

## Original Design

Mineradio 名称、MR Logo、界面视觉设计、启动动画方向、粒子视觉体验和电影镜头系统的产品表达属于作者原创设计。

emily 作为 Mineradio 早期视觉底层想法与 `emily` 视觉预设改进方向的共创者和灵感来源之一，特此致谢。

感谢小天才e宝、应春日、锋将军、軌跡、林中、骊、风痕、花椰菜🥦在早期体验、测试反馈和发布准备中的帮助。
