#!/usr/bin/env node
/**
 * 用真实 HAR 回放来验证 Loon 脚本的行为（不需要 Loon，本地 node 直接跑）。
 *
 * 用法：
 *   node test/replay-har.js [HAR 路径]
 * 默认读取 ~/Downloads/138_1795138963254.har
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const HAR = process.argv[2] || path.join(os.homedir(), "Downloads", "138_1795138963254.har");
const ROOT = path.resolve(__dirname, "..");

let failures = 0;
let checks = 0;

function check(name, fn) {
  checks++;
  try {
    fn();
    console.log("  ok   " + name);
  } catch (e) {
    failures++;
    console.log("  FAIL " + name + "\n       " + e.message);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

function loadScript(name) {
  const code = fs.readFileSync(path.join(ROOT, name), "utf8");
  const logs = [];
  const stubConsole = { log: (v) => logs.push(String(v)) };
  return function run(ctx) {
    let doneArg;
    const fn = new Function("$request", "$response", "$done", "console", code);
    const $done = function (arg) {
      assert(doneArg === undefined, "脚本调用了多次 $done");
      doneArg = arg;
    };
    fn(ctx.request, ctx.response, $done, stubConsole);
    assert(doneArg !== undefined, "脚本没有调用 $done");
    return { done: doneArg, logs };
  };
}

function decodeEntryBody(entry) {
  const c = entry.response.content || {};
  if (!c.text) return null;
  if ((c.mimeType || "").indexOf("json") === -1) return null;
  let buf = Buffer.from(c.text, "base64");
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    buf = require("zlib").gunzipSync(buf);
  }
  const s = buf.toString("utf8");
  try {
    JSON.parse(s);
    return s;
  } catch (e) {
    return null;
  }
}

function findEntry(entries, needle) {
  const e = entries.find((x) => x.request.url.indexOf(needle) !== -1);
  if (!e) throw new Error("HAR 中找不到 " + needle);
  return e;
}

const har = JSON.parse(fs.readFileSync(HAR, "utf8"));
const entries = har.log.entries;

console.log("HAR: " + HAR + " (" + entries.length + " 条记录)\n");

// ---------------------------------------------------------------------------
console.log("[1] soul-ads-ssp.js  开屏 / 信息流广告 SSP 拦截");
{
  const run = loadScript("soul-ads-ssp.js");

  const r1 = run({
    request: {
      url: "https://ssp.soulapp.cn/api/q?bi=%5B%221a1f69f60b1%22%5D&bik=32243&pageId=PostSquare_Recommend",
      method: "POST",
    },
  });
  check("推荐信息流广告请求被替换为空广告响应", () => {
    assert(r1.done && r1.done.response, "没有返回合成 response");
    assert(r1.done.response.status === 200, "status 应为 200");
    const j = JSON.parse(r1.done.response.body);
    assert(j.code === 200, "code 应为 200");
    assert(j.data.cnt === 0, "cnt 应为 0");
    assert(Array.isArray(j.data.prs) && j.data.prs.length === 0, "prs 应为空数组");
    assert(Array.isArray(j.data.prePrs) && j.data.prePrs.length === 0, "prePrs 应为空数组");
    assert(Array.isArray(j.data.strategy.ads) && j.data.strategy.ads.length === 0, "strategy.ads 应为空");
  });

  check("开屏（无 pageId）同样被拦截", () => {
    const r = run({ request: { url: "https://ssp.soulapp.cn/api/q?bi=x&bik=32243", method: "POST" } });
    const j = JSON.parse(r.done.response.body);
    assert(j.data.cnt === 0 && j.data.prs.length === 0, "开屏广告未被清空");
  });

  check("日志里带出了 pageId，方便定位开屏用的 pageId", () => {
    assert(r1.logs.some((l) => l.indexOf("PostSquare_Recommend") !== -1), "日志缺少 pageId");
  });
}

// ---------------------------------------------------------------------------
console.log("\n[2] soul-ads-follow.js  关注页顶部推荐人");
{
  const run = loadScript("soul-ads-follow.js");
  const entry = findEntry(entries, "/v5/post/focused");
  const body = decodeEntryBody(entry);
  assert(body, "抓包里的 focused 响应不是 JSON");

  check("线上真实响应（recUsers/recPosts 本来就为空）原样放行", () => {
    const r = run({ request: { url: entry.request.url }, response: { body } });
    assert(r.done.body === undefined, "不应改写响应");
  });

  check("recUsers / recPosts 被清空，posts 保留", () => {
    const j = JSON.parse(body);
    j.data.recUsers = [
      { userId: 111, signature: "推荐关注 A" },
      { userId: 222, signature: "推荐关注 B" },
    ];
    j.data.recPosts = [{ id: 999, content: "推荐帖子" }];
    const before = j.data.posts.length;
    const r = run({
      request: { url: entry.request.url },
      response: { body: JSON.stringify(j) },
    });
    const out = JSON.parse(r.done.body);
    assert(out.data.recUsers.length === 0, "recUsers 未清空");
    assert(out.data.recPosts.length === 0, "recPosts 未清空");
    assert(out.data.posts.length === before, "正常帖子被误删");
  });

  check("posts 中混入的广告卡片被剔除（兜底）", () => {
    const j = JSON.parse(body);
    const legit = j.data.posts[0];
    j.data.posts = [legit, { id: 1, type: "AD", content: "广告" }];
    const r = run({
      request: { url: entry.request.url },
      response: { body: JSON.stringify(j) },
    });
    const out = JSON.parse(r.done.body);
    assert(out.data.posts.length === 1, "广告卡片未被剔除");
    assert(out.data.posts[0].id === legit.id, "正常帖子被误删");
  });

  check("非法 JSON / 空 body 不抛错、不改写", () => {
    const r1 = run({ request: { url: entry.request.url }, response: { body: "not-json" } });
    assert(r1.done.body === undefined, "非法 JSON 不应改写");
    const r2 = run({ request: { url: entry.request.url }, response: {} });
    assert(r2.done.body === undefined, "空 body 不应改写");
  });
}

// ---------------------------------------------------------------------------
console.log("\n[3] soul-ads-feed.js  信息流接口兜底");
{
  const run = loadScript("soul-ads-feed.js");
  const rec = findEntry(entries, "/v6/post/recommended");
  const body = decodeEntryBody(rec);
  assert(body, "抓包里的 recommended 响应不是 JSON");

  check("真实推荐信息流没有广告字段时原样放行", () => {
    const r = run({ request: { url: rec.request.url }, response: { body } });
    assert(r.done.body === undefined, "不应改写响应");
  });

  check("postList 中的广告卡片被剔除（各种广告标记）", () => {
    const j = JSON.parse(body);
    const legit = j.data.postList[0];
    j.data.postList = [
      legit,
      { id: 2, type: "AD" },
      { id: 3, isAd: true },
      { id: 4, adInfo: { adId: "x" } },
      { id: 5, postExtModel: { isAd: true } },
    ];
    const r = run({ request: { url: rec.request.url }, response: { body: JSON.stringify(j) } });
    const out = JSON.parse(r.done.body);
    assert(out.data.postList.length === 1, "广告卡片没有全部剔除，剩 " + out.data.postList.length);
    assert(out.data.postList[0].id === legit.id, "正常帖子被误删");
  });

  check("主页信息流（v5/post/homepage）的 postList 同样处理", () => {
    const home = findEntry(entries, "/v5/post/homepage");
    const hb = decodeEntryBody(home);
    const j = JSON.parse(hb);
    j.data.postList = [{ id: 1, type: "TEXT" }, { id: 2, type: "AD" }];
    const r = run({ request: { url: home.request.url }, response: { body: JSON.stringify(j) } });
    const out = JSON.parse(r.done.body);
    assert(out.data.postList.length === 1 && out.data.postList[0].id === 1, "homepage 兜底失败");
  });
}

// ---------------------------------------------------------------------------
console.log("\n[4] soul-ads-popup.js  广告 / 商业化 / 增长弹窗");
{
  const run = loadScript("soul-ads-popup.js");
  const all = findEntry(entries, "/soul/global/popup/allConfig");
  const body = decodeEntryBody(all);
  assert(body, "抓包里的 allConfig 响应不是 JSON");

  check("真实 allConfig：删 36 个（AD_/UG_/Meta_/商业化 VAS/奇遇铃推广卡），功能弹窗保留", () => {
    const j = JSON.parse(body);
    const total = Object.keys(j.data).length;
    const r = run({ request: { url: all.request.url }, response: { body } });
    const out = JSON.parse(r.done.body);
    const removed = total - Object.keys(out.data).length;
    assert(removed === 36, "删除数量应为 36，实际 " + removed);
    [
      "AD_Interstitial",
      "AD_Points",
      "UG_Startup_flex",
      "UG_Cashpopup",
      "Meta_AvatarHeadLimitTimeEnd_RechargePopup",
      "VAS_LoveBell",
      "VAS_lovebellrecall",
      "VAS_SuperstarRenewPopup",
      "VAS_DouyinPayGiftpack",
      "Social_LoveBellReturnGuideCard",
    ].forEach((code) => assert(!out.data[code], code + " 未移除"));
    [
      "Social_IM",
      "Social_LoveBell",
      "Social_LoveBellLBS",
      "VAS_VOICECALL_POPUPPUSH",
      "VAS_VIDEOCALL_POPUPPUSH",
      "ChatRoom_POPUP_PUSH_NEW",
      "Square_PublishBubble",
    ].forEach((code) => assert(out.data[code], code + " 被误删"));
  });

  check("popup/config 只过滤广告/商业化/增长条目", () => {
    const j = {
      code: 10001,
      message: "success",
      data: {
        code: 1,
        msg: null,
        popInfoList: [
          { bizCode: "AD_Interstitial", name: "插屏广告" },
          { bizCode: "UG_Cashpopup", name: "现金弹窗" },
          { bizCode: "VAS_VOICECALL_POPUPPUSH", name: "语音匹配" },
          { bizCode: "Social_IM", name: "私聊消息" },
        ],
      },
      success: true,
    };
    const r = run({ request: { url: "https://api-a.soulapp.cn/soul/global/popup/config" }, response: { body: JSON.stringify(j) } });
    const out = JSON.parse(r.done.body);
    assert(out.data.popInfoList.length === 2, "过滤数量不对：" + out.data.popInfoList.length);
    const codes = out.data.popInfoList.map((x) => x.bizCode);
    assert(codes.indexOf("Social_IM") !== -1 && codes.indexOf("VAS_VOICECALL_POPUPPUSH") !== -1, "误删功能弹窗");
  });

  check("抓包里空的 popInfoList 原样放行", () => {
    const j = { code: 10001, message: "success", data: { code: 1, msg: null, popInfoList: [] }, success: true };
    const r = run({ request: { url: "https://api-a.soulapp.cn/soul/global/popup/config" }, response: { body: JSON.stringify(j) } });
    assert(r.done.body === undefined, "空列表不应改写");
  });
}

// ---------------------------------------------------------------------------
console.log("\n[5] soul-ads-ops.js  运营位 / 推荐位 / 广场弹窗 / 新人入口");
{
  const run = loadScript("soul-ads-ops.js");
  const call = (entry, body) =>
    run({ request: { url: entry.request.url }, response: { body: body === undefined ? decodeEntryBody(entry) : body } });

  check("语音房「猜你喜欢」30 条被清空", () => {
    const entry = findEntry(entries, "/post/relationUser/chatRooms");
    const before = JSON.parse(decodeEntryBody(entry)).data.userList.length;
    assert(before === 30, "抓包里语音房数量应为 30，实际 " + before);
    const out = JSON.parse(call(entry).done.body);
    assert(out.data.userList.length === 0, "语音房推荐未清空");
  });

  check("私聊打招呼弹窗：limit 置 false，文案字段保留", () => {
    const body = fs.readFileSync(path.join(ROOT, "test/fixtures/chat-limit-info.json"), "utf8");
    const before = JSON.parse(body);
    assert(before.data.limit === true, "fixture 里 limit 应为 true");
    const r = run({
      request: { url: "https://api-chat.soulapp.cn/chat/limitInfo?pageId=ChatDetail_Main" },
      response: { body },
    });
    assert(r.done.body !== undefined, "应改写响应");
    const out = JSON.parse(r.done.body);
    assert(out.data.limit === false, "limit 未置 false");
    assert(out.data.title && out.data.title.prefixText, "其它字段被误删");
  });

  check("顶部「猜你喜欢」推荐用户模块：position 置 -1", () => {
    const entry = findEntry(entries, "/v2/rec/user");
    const before = JSON.parse(decodeEntryBody(entry)).data.position;
    assert(before === 0, "抓包里 position 应为 0，实际 " + before);
    const out = JSON.parse(call(entry).done.body);
    assert(out.data.position === -1, "position 未置 -1");
  });

  check("推荐用户字段（userList/recUsers 等）被清空", () => {
    const entry = findEntry(entries, "/v2/rec/user");
    const j = {
      code: 10001,
      data: { position: 0, userList: [{ userId: 1 }], recUsers: [{ userId: 2 }], users: [{ userId: 3 }] },
      success: true,
    };
    const out = JSON.parse(call(entry, JSON.stringify(j)).done.body);
    assert(out.data.userList.length === 0, "userList 未清空");
    assert(out.data.recUsers.length === 0, "recUsers 未清空");
    assert(out.data.users.length === 0, "users 未清空");
    assert(out.data.position === -1, "position 未置 -1");
  });

  check("热 Soul 榜被清空", () => {
    const entry = findEntry(entries, "/hot/soul/rank");
    const out = JSON.parse(call(entry).done.body);
    assert(Array.isArray(out.data) && out.data.length === 0, "热榜未清空");
  });

  check("广场弹窗开关被置 0，页面列表保留", () => {
    const entry = findEntry(entries, "/square/pop/window/switch");
    const out = JSON.parse(call(entry).done.body);
    assert(out.data.popSwitch === 0, "popSwitch 未置 0");
    assert(out.data.pageIds.length > 0, "pageIds 被误删");
  });

  check("同城头图 bannerModel 被移除，其余字段保留", () => {
    const entry = findEntry(entries, "/tags/location/info/v2");
    const out = JSON.parse(call(entry).done.body);
    assert(!out.data.bannerModel, "bannerModel 未移除");
    assert(out.data.cityName === "北京市", "cityName 被误改");
  });

  check("广场子 tab 运营位（真实为空）原样放行；有内容时清空", () => {
    const entry = findEntry(entries, "/post/recSquare/subTabResource");
    assert(call(entry).done.body === undefined, "空运营位不应改写");
    const j = { code: 10001, message: "获取成功", data: { positionContentList: [{ id: 1 }] }, success: true };
    const out = JSON.parse(call(entry, JSON.stringify(j)).done.body);
    assert(out.data.positionContentList.length === 0, "运营位未清空");
  });

  check("furion 运营位（真实为空）原样放行；有内容时清空", () => {
    const emptyEntry = entries.find((e) => {
      if (e.request.url.indexOf("/furion/position/content") === -1) return false;
      const b = decodeEntryBody(e);
      if (!b) return false;
      const d = JSON.parse(b).data;
      return Array.isArray(d) && d.length === 0;
    });
    assert(emptyEntry, "HAR 里找不到返回空数组的 furion 响应");
    assert(call(emptyEntry).done.body === undefined, "空运营位不应改写");
    const entry = findEntry(entries, "/furion/position/content");
    const j = { code: 10001, message: "success", data: [{ sceneCode: "x" }], success: true };
    const out = JSON.parse(call(entry, JSON.stringify(j)).done.body);
    assert(Array.isArray(out.data) && out.data.length === 0, "furion 运营位未清空");
  });

  check("新人任务入口被置空", () => {
    const entry = findEntry(entries, "/newUser/task/getEntranceState");
    const out = JSON.parse(call(entry).done.body);
    assert(out.data === null, "新人任务入口未置空");
  });

  check("话题匹配付费卡：show=false、paidCardInfo 清空（真实响应本来就 false，原样放行）", () => {
    const entry = findEntry(entries, "/show/square/topicMatchCard");
    assert(call(entry).done.body === undefined, "无内容时不应改写");
    const j = {
      code: 10001,
      message: "success",
      data: {
        topicMatchCard: { show: true, paidCardInfo: { price: 1 }, moduleSubTitle: "测测" },
        squareLuckyBagCard: { show: true },
      },
      success: true,
    };
    const out = JSON.parse(call(entry, JSON.stringify(j)).done.body);
    assert(out.data.topicMatchCard.show === false, "topicMatchCard.show 未置 false");
    assert(out.data.topicMatchCard.paidCardInfo === null, "paidCardInfo 未清空");
    assert(Object.keys(out.data.squareLuckyBagCard).length === 0, "福袋卡未清空");
  });

  check("非法 JSON / 空 body 不抛错、不改写", () => {
    const entry = findEntry(entries, "/hot/soul/rank");
    assert(call(entry, "oops").done.body === undefined, "非法 JSON 不应改写");
    assert(call(entry, undefined).done.body !== undefined, "真实响应应被改写");
  });
}

// ---------------------------------------------------------------------------
console.log("\n[6] soul-ads-config.js  开屏兜底 + 商业化 banner");
{
  const run = loadScript("soul-ads-config.js");
  const call = (entry, body) =>
    run({ request: { url: entry.request.url }, response: { body: body === undefined ? decodeEntryBody(entry) : body } });

  check("开屏引导位：真实 allow=false 原样放行；allow=true 时强制 false", () => {
    const entry = findEntry(entries, "/api/open/guide-position/check");
    assert(call(entry).done.body === undefined, "allow 已为 false，不应改写");
    const j = { code: 10001, message: "获取成功", data: { allow: true }, success: true };
    const out = JSON.parse(call(entry, JSON.stringify(j)).done.body);
    assert(out.data.allow === false, "allow 未强制 false");
    assert(out.data.rejectReasonCode, "缺少 rejectReasonCode");
  });

  check("启动策略：真实 result=false 原样放行；true 时强制 false", () => {
    const entry = findEntry(entries, "/increase/startup/policy");
    assert(call(entry).done.body === undefined, "result 已为 false，不应改写");
    const j = { code: 10001, message: "success", data: { result: true, type: 1, jumpUrl: "https://x" }, success: true };
    const out = JSON.parse(call(entry, JSON.stringify(j)).done.body);
    assert(out.data.result === false && out.data.jumpUrl === null, "启动策略未压掉");
  });

  check("启动落地页：真实 null 原样放行；有值时置 null", () => {
    const entry = findEntry(entries, "/app/landing/page/get");
    assert(call(entry).done.body === undefined, "已为 null，不应改写");
    const j = { code: 10001, message: "success", data: { url: "https://ad" }, success: true };
    const out = JSON.parse(call(entry, JSON.stringify(j)).done.body);
    assert(out.data === null, "落地页未置空");
  });

  check("apollo：关闭商业化 banner、清空挂载页面、关掉广告落地页站，其它配置不动", () => {
    const entry = findEntry(entries, "/app/apollo/config");
    const before = JSON.parse(decodeEntryBody(entry));
    const out = JSON.parse(call(entry).done.body);
    const gc = out.data.globalConfig;
    assert(gc.new_commercial_banner_open === "false", "banner 开关未关");
    assert(gc.global_banner_page_config === "[]", "banner 页面列表未清空");
    assert(JSON.parse(gc.global_banner_allPage_config).app.length === 0, "allPage banner 未清空");
    assert(JSON.parse(gc.adStationConf).enable === 0, "广告落地页站未关闭");
    assert(gc.useX5 === before.data.globalConfig.useX5, "其它配置被改动");
    assert(Object.keys(gc).length === Object.keys(before.data.globalConfig).length, "配置项数量变化");
  });

  check("非法 JSON / 空 body 不抛错、不改写", () => {
    const entry = findEntry(entries, "/app/apollo/config");
    assert(call(entry, "oops").done.body === undefined, "非法 JSON 不应改写");
  });
}

// ---------------------------------------------------------------------------
console.log("\n[7] 四个插件变体体检");
{
  const PLUGINS = ["SoulAds.plugin", "SoulAds-jsdelivr.plugin", "SoulAds-ghproxy.plugin", "SoulAds-local.plugin"];
  const targetUrls = [
    "/api/q",
    "/v5/post/focused",
    "/v6/post/recommended",
    "/soul/global/popup/allConfig",
    "/post/relationUser/chatRooms",
    "/v2/rec/user",
    "/hot/soul/rank",
    "/post/recSquare/subTabResource",
    "/square/pop/window/switch",
    "/tags/location/info/v2",
    "/furion/position/content",
    "/newUser/task/getEntranceState",
    "/show/square/topicMatchCard",
    "/api/open/guide-position/check",
    "/increase/startup/policy",
    "/app/landing/page/get",
    "/app/apollo/config",
  ];

  check("版本化脚本目录齐全，且与根目录脚本一致", () => {
    const version = fs.readFileSync(path.join(ROOT, "VERSION"), "utf8").trim();
    const dir = path.join(ROOT, version);
    assert(fs.existsSync(dir), "缺少 " + version + "/ 目录");
    ["soul-ads-ssp.js", "soul-ads-follow.js", "soul-ads-feed.js", "soul-ads-popup.js", "soul-ads-ops.js", "soul-ads-config.js"].forEach((f) => {
      assert(fs.existsSync(path.join(dir, f)), version + "/ 缺少 " + f);
      const a = fs.readFileSync(path.join(dir, f));
      const b = fs.readFileSync(path.join(ROOT, f));
      assert(a.equals(b), version + "/" + f + " 与根目录脚本不一致");
    });
  });

  check("主插件描述版本号与 VERSION 文件一致", () => {
    const version = fs.readFileSync(path.join(ROOT, "VERSION"), "utf8").trim();
    assert(/^v\d+\.\d+$/.test(version), "VERSION 格式异常：" + version);
    ["SoulAds.plugin", "SoulAds-ghproxy.plugin", "SoulAds-jsdelivr.plugin", "SoulAds-local.plugin"].forEach((name) => {
      const plugin = fs.readFileSync(path.join(ROOT, name), "utf8");
      const desc = (plugin.match(/^#!desc=(.+)$/m) || [])[1] || "";
      assert(desc.indexOf(version) === 0, name + " 描述不是 " + version + " 开头：" + desc.slice(0, 24));
    });
  });

  PLUGINS.forEach((name) => {
    const plugin = fs.readFileSync(path.join(ROOT, name), "utf8");

    check(name + "：元数据齐全", () => {
      assert(/#!name\s*=/.test(plugin), "缺少 #!name");
      assert(/#!desc\s*=/.test(plugin), "缺少 #!desc");
    });

    check(name + "：6 个脚本引用（远程 URL 或本地文件名）都能对上文件", () => {
      const refs = plugin.match(/script-path=([^,\s]+)/g) || [];
      const unique = [...new Set(refs.map((x) => x.replace("script-path=", "").trim()))];
      assert(unique.length === 6, "脚本引用数应为 6，实际 " + unique.length);
      unique.forEach((ref) => {
        if (/^https?:\/\//.test(ref)) {
          const base = ref.split("/").pop();
          assert(fs.existsSync(path.join(ROOT, base)), "远程脚本在仓库里没有对应文件：" + ref);
        } else {
          assert(fs.existsSync(path.join(ROOT, ref)), "找不到脚本文件：" + ref);
        }
      });
    });

    check(name + "：MITM 覆盖六个域名", () => {
      const mitm = (plugin.match(/\[MITM\][\s\S]*?hostname\s*=\s*(.+)/) || [])[1] || "";
      ["ssp.soulapp.cn", "post.soulapp.cn", "api-a.soulapp.cn", "api-user.soulapp.cn", "increase-openapi.soulapp.cn", "api-ucc.soulapp.cn", "api-chat.soulapp.cn"].forEach((h) => {
        assert(mitm.indexOf(h) !== -1, "MITM 缺少 " + h);
      });
    });

    check(name + "：脚本正则命中抓包里的真实 URL", () => {
      const regexes = [];
      plugin.split(/\r?\n/).forEach((line) => {
        const m = /^http-(?:request|response)\s+(\S+)/.exec(line);
        if (m) regexes.push(new RegExp(m[1]));
      });
      assert(regexes.length === 11, "脚本条目应为 11 条，实际 " + regexes.length);
      const realUrls = targetUrls.map((needle) => findEntry(entries, needle).request.url);
      realUrls.push("https://api-chat.soulapp.cn/chat/limitInfo?pageId=ChatDetail_Main");
      realUrls.forEach((u) => {
        const hit = regexes.some((re) => re.test(u));
        assert(hit, "没有正则能命中 " + u.split("?")[0]);
      });
    });
  });
}

console.log("\n" + (failures === 0 ? "全部通过" : failures + " 项失败") + "（共 " + checks + " 项检查）");
process.exit(failures === 0 ? 0 : 1);
