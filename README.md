# Soul 去广告 Loon 插件

基于抓包 `138_1795138963254.har`（Soul 6.35.0 / iOS 27.0.1）写的 Loon 插件，仓库：[27149/soul-loon-ads](https://github.com/27149/soul-loon-ads)，当前版本 **v2.3**。抓包依据和每组可选项见 [AD-SURFACES.md](AD-SURFACES.md)。

## 已实现

| 组 | 内容 | 脚本 |
| --- | --- | --- |
| 开屏 + 信息流广告 | `ssp.soulapp.cn/api/q` 全部回空广告（推荐/关注/同城/主页TA + 开屏） | `soul-ads-ssp.js` |
| 关注页顶部推荐人 | 清空 `/v5/post/focused` 的 `recUsers` / `recPosts`（兼容 `recUserList` 等字段） | `soul-ads-follow.js` |
| 顶部「猜你喜欢」推荐用户 | `/v2/rec/user` 的 `position` 置 -1，并清空 `userList/users/recUsers` | `soul-ads-ops.js` |
| 私聊「打招呼」弹窗 | `chat/limitInfo` 的 `limit` 置 `false` | `soul-ads-ops.js` |
| 信息流兜底 | 剔除 `postList` 里 `type=AD` / `isAd` / `adInfo` 等广告卡片 | `soul-ads-feed.js` |
| 弹窗（36/95） | `AD_*` 广告、`UG_*` 增长拉活、`Meta_*` 付费头像、商业化 `VAS_*`、奇遇铃推广卡 | `soul-ads-popup.js` |
| 语音房推荐 | `post/relationUser/chatRooms` 的 30 条「猜你喜欢」 | `soul-ads-ops.js` |
| 广场/内容运营位 | 热 Soul 榜、话题匹配付费卡、福袋卡、recSquare 运营位、同城头图 banner、furion 运营位 | `soul-ads-ops.js` |
| 广场弹窗 + 新人入口 | `square/pop/window/switch` 置 `popSwitch:0`，新人任务入口置空 | `soul-ads-ops.js` |
| 开屏兜底 | `guide-position/check` 强制 `allow:false`、`startup/policy` 强制 `result:false`、启动落地页置 null | `soul-ads-config.js` |
| 全页面商业化 banner | apollo 里 `new_commercial_banner_open=false`、清空 banner 页面列表、关掉广告落地页站 | `soul-ads-config.js` |
| 广告上报/归因 | REJECT `ad-r` / `soul-ad` / `oceanengine` / `qchannel03` / `sofire` / `volceapplog` | 插件 `[Rule]` |

## 文件结构

```
soul-loon-ads/                  # https://github.com/27149/soul-loon-ads
├── SoulAds.plugin            # 远程脚本版（raw.githubusercontent）
├── SoulAds-jsdelivr.plugin   # 远程脚本版（fastly.jsdelivr.net，国内推荐）
├── SoulAds-ghproxy.plugin    # 远程脚本版（ghproxy 备用）
├── SoulAds-v2.1.plugin       # 旧版固定文件（保留兼容，可忽略）
├── SoulAds-local.plugin      # 本地脚本版（script-path 用文件名）
├── VERSION                   # 当前版本号（v2.3）
├── v2.3/                     # 版本化脚本目录（插件按版本引用，避免脚本缓存；v2.2/ 保留兼容旧安装）
├── soul-ads-ssp.js           # 开屏/信息流广告 SSP 拦截（请求级短路）
├── soul-ads-follow.js        # 关注页顶部推荐人
├── soul-ads-feed.js          # 信息流接口兜底
├── soul-ads-popup.js         # 广告/商业化/增长弹窗
├── soul-ads-ops.js           # 运营位/推荐位/广场弹窗/新人入口
├── soul-ads-config.js        # 开屏兜底 + 商业化 banner
├── AD-SURFACES.md            # 抓包里的广告/推广位清单与证据
├── README.md
└── test/
    ├── replay-har.js         # 用真实 HAR 回放验证脚本（node）
    └── fixtures/
        └── yixinli-ad.json   # HAR 里那条壹心理广告的原始字段（留档）
```

## 抓包依据（摘要）

### 广告 SSP（唯一广告素材出口）

```
POST https://ssp.soulapp.cn/api/q?bi=[...]&bik=32243&pageId=<页面>   (gzip -> JSON)
{ "code": 200, "data": { "cnt": 1, "prs": [ { "ideaId": "7819294", "adOwnerSignature": "壹心理", ... } ] } }
```

| 场景 | pageId | 抓到的广告 |
| --- | --- | --- |
| 推荐信息流 | `PostSquare_Recommend` | `ideaId=7819294`、`adOwnerSignature="壹心理"`、`position=10`、按钮「测测看」 |
| 关注信息流 | `PostSquare_Follow` | `ideaId=7819274/7819272`、`adOwnerSignature="泰鑫汇"`、`position=5` |
| 广场主页 / 地图 | `HomePage_TAMain` / `PostSquare_Map` | 本次未命中 |
| 开屏 | 本 HAR 热启动未录到；社区配置同接口处理 | — |

**全量扫描结果：746 条记录里只有 `ssp.soulapp.cn/api/q` 的响应带广告字段**，其余接口都是业务/运营数据。穿山甲、优量汇、百度在本抓包里只有 SDK 初始化和归因上报，没有广告展示请求。

### 关注页三块推荐内容

```json
// GET post.soulapp.cn/v5/post/focused
{ "data": { "posts": [...], "recUsers": [...], "recPosts": [...] } }

// GET post.soulapp.cn/post/relationUser/chatRooms?pageId=PostSquare_Follow&pageIndex=1&pageSize=30
{ "data": { "userList": [ { "roomId": 382964351, "subTitle": "猜你喜欢", "roomContentLabel": "交友扩列" } ] } }  // 30 条

// GET post.soulapp.cn/v2/rec/user?pageId=PostSquare_Recommend&sceneType=2
{ "data": { "position": 0 } }   // 顶部「猜你喜欢」推荐用户的插入位置；用户列表可能在同一响应或 focused.recUsers 里
```
```

### 私聊「打招呼」弹窗

```json
// GET api-chat.soulapp.cn/chat/limitInfo?pageId=ChatDetail_Main
{ "data": { "limit": true, "limitPopupStyleCode": 0,
  "title": { "prefixText": "Ta正好", "midText": "在线", "suffixText": "现在快去聊聊吧" },
  "subMsg": "想认识你，从一朵花的问候开始",
  "extMsg": "超级星人每天可免费送出5个开聊礼物(活动已结束)",
  "bottomText": { "text": "购买打招呼权益包，通兑99Soul币以下礼物，更划算" } } }
```

`limit:true` 时客户端弹「打招呼/购买权益包」框；脚本把 `limit` 置 `false`（社区去广告脚本同样处理），其余字段保留。

### 弹窗 / 运营位 / banner

- `popup/allConfig` 95 个弹窗：`AD_Interstitial`、`AD_Points`、19 个 `UG_*`、5 个 `Meta_*`、`VAS_LoveBell*`、`Social_LoveBellReturnGuideCard` 等。
- `hot/soul/rank` 15 条热榜；`show/square/topicMatchCard` 含 `paidCardInfo`；`tags/location/info/v2` 带同城头图 `bannerModel`。
- apollo `new_commercial_banner_open="true"`，`global_banner_page_config` 挂了 20+ 页面；`adStationConf.enable=1`。
- 开屏兜底接口：`guide-position/check`（`allow:false`）、`increase/startup/policy`（`result:false`）、`app/landing/page/get`（`null`）。

## 安装

### 方式一：固定 URL 安装（推荐，装一次以后点更新）

| 线路 | 插件地址（固定不变） |
| --- | --- |
| **GitHub Pages（推荐）** | `https://27149.github.io/soul-loon-ads/SoulAds.plugin` |
| ghproxy（备用，实时无 CDN 缓存） | `https://ghproxy.net/https://raw.githubusercontent.com/27149/soul-loon-ads/main/SoulAds-ghproxy.plugin` |

Safari 直接打开：

- `loon://import?plugin=https%3A%2F%2F27149.github.io%2Fsoul-loon-ads%2FSoulAds.plugin`
- `loon://import?plugin=https%3A%2F%2Fghproxy.net%2Fhttps%3A%2F%2Fraw.githubusercontent.com%2F27149%2Fsoul-loon-ads%2Fmain%2FSoulAds-ghproxy.plugin`

安装后：

1. **更新**：Loon → 配置 → 插件，在条目上点「更新」即可，**地址不变**，不用删了重装。
2. **确认版本**：插件描述以 `v2.3 ·` 开头（对应 `#!desc`），注释里也有 `# 版本：v2.3`。
3. **脚本缓存**：脚本放在版本化目录（本次是 `v2.3/`），插件更新后脚本路径也换新，不会读到旧脚本。
4. GitHub Pages 首次发布可能要 1 分钟左右生效；如果打不开，先换 ghproxy 那条。

> 旧地址（`raw.githubusercontent.com/.../SoulAds.plugin`、jsDelivr `@main`、tag `v2.1`）仍然能用，但不再作为主推；`raw` 在国内经常连不上，jsDelivr `@main` 各节点缓存不一致。

### 方式二：本地脚本安装（离线/自持）

1. Loon 安装并信任证书，打开 MITM。
2. 把 **6 个 `.js`** 拷进 **iCloud Drive/Loon/Script/**，文件名不要改（Loon 本地脚本按文件名引用）。
3. 添加 `SoulAds-local.plugin`（script-path 是文件名）。
4. 确认 Soul 流量走 Loon。

插件 `[MITM]` 会自动解密：`ssp.soulapp.cn`、`post.soulapp.cn`、`api-a.soulapp.cn`、`api-user.soulapp.cn`、`increase-openapi.soulapp.cn`、`api-ucc.soulapp.cn`。

## 验证

- Loon → 工具 → 脚本日志，刷新 Soul 时应看到：
  - `[SoulAds] 已拦截广告请求：PostSquare_Recommend（返回空广告）`
  - `[SoulAds] 已移除 36 个广告/商业化/增长弹窗`
  - `[SoulAds] 已清理语音房推荐`
  - `[SoulAds] 已关闭商业化 banner / 广告落地页站`
- App 内：推荐/关注信息流无广告卡片；关注页顶部无推荐人、无语音房横条；冷启动无开屏；广场无活动弹窗；新人无任务入口；各页面无商业横幅。
- 有接口日志但界面没变化，说明该模块在本次会话本来就没有内容（脚本对空数据原样放行，不会改坏响应）。

## 原理与取舍

- **请求级短路**：`soul-ads-ssp.js` 用 `http-request` + `$done({response})` 直接返回 `cnt=0` 的合法广告 JSON，广告请求不出网，SDK 也不会因解析失败重试。
- **只改对应的 JSON 字段**：弹窗按 bizCode 删、运营位清空列表、banner 改开关，其它字段原样保留；没有内容时 `$done({})` 原样放行，不动分页游标/实验数据。
- **apollo 只动广告键**：`new_commercial_banner_open`、两个 `global_banner_*`、`adStationConf`，其余 400+ 配置键保持不变（测试有校验）。
- **不碰功能接口**：`loveBell/*`（奇遇铃配置）、官方账号列表、聊天菜单（礼物/好物）、`api-pay`、`MeasureResult`（其实是性格/匹配测试）、Soul 自建埋点都保持原样。

## 可调项（想恢复某一组时）

- **只恢复语音房推荐**：把插件第 5 组正则里的 `post\/relationUser\/chatRooms|` 删掉，或删 `soul-ads-ops.js` 对应分支。
- **恢复顶部「猜你喜欢」推荐用户**：把第 5 组正则里的 `v2\/rec\/user|` 删掉，或删 `soul-ads-ops.js` 里 `v2/rec/user` 分支。
- **恢复私聊打招呼弹窗**：删掉插件第 5 组最后那条 `api-chat.../chat/limitInfo`，或删 `soul-ads-ops.js` 里 `chat/limitInfo` 分支。
- **恢复部分弹窗**：编辑 `soul-ads-popup.js` 顶部的 `REMOVE_PREFIXES`（`AD_`/`UG_`/`META_`）和 `REMOVE_CODES`（精确 bizCode）。例如保留「付费到期提醒」就从 `UG_` 里单独放行 `UG_PaidItemExpireNotice`（需要把前缀判断改成精确列表）。
- **恢复某个运营位**：从插件第 5 组对应正则里去掉路径，或删 `soul-ads-ops.js` 里那段 `else if`。
- **恢复商业化 banner**：删掉插件第 6 组里 `api-ucc.soulapp.cn/app/apollo/config` 那一行。
- **恢复开屏兜底**：删掉第 6 组里 `guide-position` / `startup/policy` / `landing` 对应行。
- **不拦归因域名**：删 `[Rule]` 里对应 `DOMAIN,...`。

## 已知限制

- Soul 改版换接口/字段后，脚本会原样放行（不会弄坏功能，但也不再生效），按新抓包补规则即可。
- 只对命中 MITM 的 HTTPS 生效；Soul 当前没有证书固定（这份 HAR 就是 Loon 解出来的）。
- 关掉广场弹窗总开关后，广场的**所有**弹窗都不弹（含正常公告）；不想要就连同第 5 组一起调整。
- 开屏若来自本地缓存，先清 Soul 缓存或重装一次再验证。
- 插件不碰登录、风控、支付等接口。

## 测试

```bash
cd soul-loon-ads
node test/replay-har.js                     # 默认读 ~/Downloads/138_1795138963254.har
node test/replay-har.js /path/to/xxx.har     # 指定别的 HAR
```

把 HAR 里的真实响应喂给 6 个脚本，覆盖：广告响应替换、关注页 `recUsers`/`recPosts`、顶部推荐用户、私聊打招呼弹窗、信息流广告卡片、36 个弹窗删除且功能弹窗保留、语音房/热榜/运营位/广场弹窗/新人入口/同城 banner、开屏兜底、apollo banner 开关（其它配置不变）、空 body/非法 JSON 不抛错、插件正则命中真实 URL。当前 **48 项全部通过**。
