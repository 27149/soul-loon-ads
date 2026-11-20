# 抓包里的广告 / 推广位清单（供决定是否屏蔽）

依据：`138_1795138963254.har`（Soul 6.35.0 / iOS 27.0.1，Loon 抓包，746 条记录，约 70 秒）
说明：本抓包里**只有 `ssp.soulapp.cn/api/q` 的响应带广告字段**（`prs/ideaId/adOwnerSignature/cpm`）。其余"广告感"来自运营位、商业化弹窗、推荐模块和追踪域名。

> **状态：A–H 全部已按选择实现**，唯一保留的是 B 组 `loveBell/*` 功能接口（拦了会破坏奇遇铃）。实现见 [README.md](README.md)。

---

## 0. 已经处理（当前版插件）

| 模块 | 接口 | 证据 |
| --- | --- | --- |
| 开屏广告 | `POST ssp.soulapp.cn/api/q` | 本 HAR 热启动未录到；社区配置同接口处理 |
| 信息流广告（推荐/关注/广场/地图） | 同上 | 壹心理 `ideaId=7819294`、泰鑫汇 `ideaId=7819274/7819272` |
| 关注页顶部推荐人 | `GET post.soulapp.cn/v5/post/focused` | `data.recUsers` / `data.recPosts` |
| 插屏 / 积分广告弹窗 | `GET api-a.soulapp.cn/soul/global/popup/(config\|allConfig)` | `AD_Interstitial`、`AD_Points` |
| 广告上报 / 物料 CDN | `ad-r.soulapp.cn`、`soul-ad.soulapp.cn` | 规则 REJECT |

---

## A. 语音推荐（语音房「猜你喜欢」）

| 项 | 内容 |
| --- | --- |
| 接口 | `GET post.soulapp.cn/post/relationUser/chatRooms?pageId=PostSquare_Follow&pageIndex=1&pageSize=30` |
| 抓包证据 | `data.userList` 30 条，`subTitle` **全部是「猜你喜欢」**，每条带 `roomId`、`roomContentLabel`（交友扩列/游戏闲聊）、`relationType=16`、房间头像/呼吸动效 |
| 性质 | 语音房推荐模块（不是付费广告，但属于推荐位） |
| 屏蔽做法 | 响应里把 `data.userList` 置 `[]` |
| 影响 | 关注页/消息页少一块语音房推荐，功能本身不受影响 |
| 建议 | **可删**（你提到"语音推荐"，应该就是这个） |

## B. 奇遇铃

| 项 | 内容 |
| --- | --- |
| 接口 | `api-a.soulapp.cn/loveBell/getUserConfig`、`queryMatchSpeedupConf`、`isNewOr30ReInstall`、`getInfoInChat` |
| 抓包证据 | `fateCardState:0`、`userFunctionState:0`、`speedupCount:1`、`popPackageCard:null`、`isSpeedup:null` —— 都是**功能配置**，没有广告素材 |
| 性质 | 付费匹配功能（奇遇铃/恋爱铃）本体，不是广告 |
| 结论 | **不建议拦**，拦了会影响奇遇铃和聊天里的匹配信息 |
| 真正的"广告感"来源 | 弹窗目录里的 `VAS_LoveBell`（付费恋爱铃）、`VAS_lovebellrecall`（召回）、`VAS_LoveBellCompensate`（加速卡补偿）、`Social_LoveBellReturnGuideCard`（主页引导）、`Social_LoveBellLBS` —— 属于下面 D 组 |

## C. 全页面商业化 Banner（apollo 开关）

| 项 | 内容 |
| --- | --- |
| 接口 | `GET api-ucc.soulapp.cn/app/apollo/config` |
| 抓包证据 | `new_commercial_banner_open = "true"`；`global_banner_page_config` / `global_banner_allPage_config` 挂了 20+ 页面：`planet`、`square`、`me`、`/post/postDetail`、`/chat/box`、`/account/userHomepage` …；`adStationConf.enable = 1`（广告 H5 落地页站） |
| 性质 | 全 App 商业化 banner 能力开关（横幅/内嵌推广位） |
| 屏蔽做法 | 响应里把 `new_commercial_banner_open` 改 `"false"`，两个 banner 页面列表清空，`adStationConf.enable` 改 0 |
| 影响 | 所有页面的商业化 banner 都不显示；若 Soul 有用活动 banner 做运营，可能一并消失 |
| 建议 | 本抓包没抓到实际 banner 内容（`furion` 运营位返回空），属于"预防性"开关；**出现过横幅广告就加** |

## D. 商业化 / 增长弹窗（`popup/allConfig` 目录，95 个）

`popup/config` 才是本次要弹的队列（抓包里 `popInfoList: []`，没弹），`allConfig` 是全部开关/频控。

| 组 | 数量 | 代表 bizCode | 性质 | 建议 |
| --- | --- | --- | --- | --- |
| `AD_*` | 2 | `AD_Interstitial` 插屏、`AD_Points` 积分导流 | 广告 | 已屏蔽 |
| `VAS_*` | 16 | `VAS_VOICECALL_POPUPPUSH` 语音匹配、`VAS_VIDEOCALL_POPUPPUSH` 视频匹配、`VAS_LoveBell` 付费恋爱铃、`VAS_lovebellrecall` 召回、`VAS_SuperstarRenewPopup` 超级星人续费、`VAS_DouyinPayGiftpack` 抖音支付礼包 | 商业化/付费引导 | **可删商业化类**（见下方精确清单） |
| `UG_*` | 19 | `UG_Startup_flex` 增长容器、`UG_Cashpopup` 现金裂变、`UG_NOTICE_GLOBAL_POPUP`、`UG_PaidItemExpireNotice` 付费到期、`UG_MaleSocialEffect` 男性社交引导 | 增长/拉活 | **可删**（含"付费到期提醒"等功能通知，看你要不要） |
| `Meta_*` | 5 | `Meta_NewUserAvatarHead_GiftPack` 新用户付费头像、`Meta_AvatarHeadLimitTimeEnd_RechargePopup` 头像续费 | 商业化 | 可删 |
| `Square_*` | 19 | `Square_SOPublishPopType_*` 发帖引导、`Square_SupriseCard` 纪念日、`Square_PublishBubble` 发布气泡 | 功能引导 | 不建议删（不是广告） |
| `ChatRoom*` | 8 | 群聊邀请/开播提醒 | 功能 | 不建议删 |
| `Social_*` | 22 | 恋爱铃引导、未成年提示、通知引导 | 功能 + 少量商业化 | 只建议删 `Social_LoveBell*` |

精确的"商业化弹窗"清单（如果整组删）：

```
VAS_VOICECALL_POPUPPUSH
VAS_VIDEOCALL_POPUPPUSH
VAS_VoiceMatchEmoplaymate
VAS_VoiceMatchreserve
VAS_VoiceMatchTarget
VAS_LOWPEAK_VOICEMATCH_POPUPWINDOW
VAS_PLANET_LOWPEAK_VIDEOMATCH_POPUPWINDOW
VAS_PLANET_LOWPEAK_AUDIOMATCH_POPUPWINDOW
VAS_LoveBell
VAS_lovebellrecall
VAS_LoveBellCompensate
VAS_SuperstarRenewPopup
VAS_SUPERMEMBER_POPUPPUSH
VAS_DouyinPayGiftpack
Social_LoveBellReturnGuideCard
Social_LoveBellLBS
Meta_NewUserAvatarHead_GiftPack
Meta_Newusercatch
Meta_AvatarHeadLimitTimeEnd_RechargePopup
Meta_AvatarHeadLimitTimeEnd_OverTime_Popup
```

## E. 广场 / 内容运营位

| 项 | 接口 | 抓包证据 | 性质 | 屏蔽做法 | 影响 | 建议 |
| --- | --- | --- | --- | --- | --- | --- |
| 热 Soul 榜 | `post.soulapp.cn/hot/soul/rank` | 15 条话题榜（`title/subtitle/tagId/jumpUrl/score`） | 运营榜单 | `data=[]` | 热榜消失 | 可选 |
| 话题匹配付费卡 | `api-a.soulapp.cn/show/square/topicMatchCard` | `show:false`，含 `paidCardInfo`、`squareLuckyBagCard` | 付费推广卡（出现时才有） | 恒定 `show=false` | 无 | 可选 |
| 广场子 tab 运营位 | `post.soulapp.cn/post/recSquare/subTabResource` | `positionContentList: []` | 运营位 | 置空 | 无（现在是空） | 可选 |
| 运营位（furion） | `api-user.soulapp.cn/furion/position/(content\|refresh)` | 聊天 `chatguide.selfintro`（沉默用户引导）；广场 `sceneCode 37/9/195/69`、关注 `221/159` 均为空 | 运营/引导位 | 返回 `[]` | 运营引导卡消失 | 可选 |
| 同城页头图 banner | `post.soulapp.cn/tags/location/info/v2` | `bannerModel.bgUrl/iconUrl/nightBgUrl` | 城市主题运营图 | 删 `bannerModel` | 同城头图变默认 | 低优先 |
| 官方账号标识 | `post.soulapp.cn/official/account/list`（546 个）、`/post/user/homepage/get/user/official` | 只有账号 ID 列表 | 内容打标，不是展示位 | — | 可能影响官方内容识别 | **不要拦** |

## F. 开屏兜底（可能进一步压掉开屏/启动跳转）

| 项 | 接口 | 抓包证据 | 屏蔽做法 | 影响 |
| --- | --- | --- | --- | --- |
| 开屏引导位频控 | `POST api-a.soulapp.cn/api/open/guide-position/check` | `allow:false`，`rejectReasonCode: VERSION_LIMIT_REACHED`（达到版本频控上限） | 恒返回 `allow:false` | 开屏引导类流程不触发 |
| 启动策略 | `GET increase-openapi.soulapp.cn/increase/startup/policy` | `result:false, type:null, jumpUrl:null` | 恒返回 `result:false` | 冷启动不跳活动页 |
| 启动落地页 | `GET api-a.soulapp.cn/app/landing/page/get` | `data:null` | 恒返回 `null` | 无 |

## G. 广场弹窗总开关 / 新人任务 / 版本提示

| 项 | 接口 | 证据 | 性质 | 屏蔽做法 | 影响 |
| --- | --- | --- | --- | --- | --- |
| 广场弹窗开关 | `post.soulapp.cn/square/pop/window/switch` | `popSwitch:1`，页面 `square`/`/post/postDetail`/`/square/answer`… | 广场活动弹窗总开关 | `popSwitch:0` | 广场所有弹窗消失（含正常公告） |
| 新人任务入口 | `api-user.soulapp.cn/newUser/task/getEntranceState` | `data:null` | 增长 | 恒 `null` | 新人任务入口消失 |
| 版本升级提示 | `gateway-mobile-gray.soulapp.cn/mobile/app/version/queryIos` | `updateType:0`「已是最新版本」 | 功能 | 恒 `updateType:0` | 不再提示更新 |

## H. 广告追踪 / 归因（不改变界面，只减少上报）

| 域名 | 抓包次数 | 用途 | 建议 |
| --- | --- | --- | --- |
| `ad-r.soulapp.cn` | 7 | 广告曝光/点击上报 | 已 REJECT |
| `soul-ad.soulapp.cn` | 0（仅素材 URL） | 广告素材 CDN | 已 REJECT |
| `analytics.oceanengine.com` | 1 | 巨量（穿山甲）归因 | 可 REJECT |
| `i.qchannel03.cn` | 2 | 腾讯广告归因 | 可 REJECT |
| `sofire.baidu.com` | 2 | 百度联盟 | 可 REJECT |
| `toblog.volceapplog.com` / `klink.volceapplog.com` | 4 | 穿山甲 SDK 日志/设备注册 | 可 REJECT（可选） |
| `data-collector.soulapp.cn` / `insight.soulapp.cn` | 17 | Soul 自建埋点 | **不建议拦**（可能影响功能/统计） |
| `api-a.soulapp.cn/MeasureResult/New` | 3 | 性格/匹配测试结果（`soul_zdx/星象/七格`），**不是广告监测** | 不要拦 |

## I. 第三方广告 SDK 的实际展示请求

本抓包里**没有**穿山甲/优量汇/百度的广告展示请求（没有 `pangolin-sdk-toutiao`、`gdt.qq.com`、`cpro.baidu.com` 之类的域名），只有 SDK 初始化和归因上报。
结论：开屏与信息流广告由 Soul 自建 SSP（`ssp.soulapp.cn`）下发，拦它就够；第三方 SDK 目前只是挂着。

---

## 最终选择（已实现）

| 组 | 是否实现 | 备注 |
| --- | --- | --- |
| A 语音房推荐 | ✅ | `chatRooms` 的 `userList` 清空 |
| B 奇遇铃 | 🟡 只清推广弹窗 | `VAS_LoveBell*` / `Social_LoveBellReturnGuideCard` 删；`loveBell/*` 功能接口保留 |
| C 全页面商业化 banner | ✅ | apollo 开关 + 页面列表 + 广告落地页站 |
| D 商业化/增长弹窗 | ✅ | 删除 36/95（AD_/UG_/Meta_/商业化 VAS/奇遇铃推广卡） |
| E 广场/内容运营位 | ✅ | 热榜、话题卡、recSquare、furion、同城头图 |
| F 开屏兜底 | ✅ | guide-position / startup-policy / landing page |
| G 广场弹窗 + 新人入口 | ✅ | `popSwitch=0`、新人任务入口置空 |
| H 广告归因域名 | ✅ | oceanengine / qchannel03 / sofire / volceapplog |
