/**
 * Soul 去广告 —— 信息流接口兜底清理
 *
 * 类型：Loon http-response 脚本
 * 匹配：^https://post.soulapp.cn/v5/post/homepage   广场信息流
 *       ^https://post.soulapp.cn/v6/post/recommended 推荐信息流
 *
 * 说明：
 *   信息流广告主要来自 ssp.soulapp.cn/api/q（由 soul-ads-ssp.js 拦截），
 *   正常情况下这俩接口里只有正常帖子。但服务端偶尔会把广告/推广卡片
 *   直接塞进 postList（type=AD、isAd=true、带 adInfo 等），这里做一层兜底过滤。
 *   没有广告时脚本原样放行，不改动任何数据，不影响分页游标。
 */

(function () {
  function isAdPost(p) {
    if (!p || typeof p !== "object") return false;
    var t = String(p.type || "").toUpperCase();
    if (t === "AD" || t === "ADS" || t === "ADVERT" || t === "AD_POST" || t === "ADVERTISING") return true;
    if (p.isAd === true || p.isAdPost === true || p.ad === true) return true;
    if (p.adInfo || p.adDetail || p.adDetailInfo) return true;
    var ext = p.postExtModel;
    if (ext && typeof ext === "object" && (ext.isAd === true || ext.adInfo)) return true;
    return false;
  }

  var body = $response && $response.body;
  if (!body) {
    $done({});
    return;
  }

  var json;
  try {
    json = JSON.parse(body);
  } catch (e) {
    $done({});
    return;
  }

  var data = json && json.data;
  if (!data || typeof data !== "object") {
    $done({});
    return;
  }

  var changed = false;

  var lists = ["postList", "posts", "recPosts"];
  for (var k = 0; k < lists.length; k++) {
    var list = data[lists[k]];
    if (!Array.isArray(list) || list.length === 0) continue;
    var kept = [];
    for (var i = 0; i < list.length; i++) {
      if (!isAdPost(list[i])) kept.push(list[i]);
    }
    if (kept.length !== list.length) {
      data[lists[k]] = kept;
      changed = true;
    }
  }

  if (!changed) {
    $done({});
    return;
  }

  try {
    console.log("[SoulAds] 已从信息流接口剔除广告卡片");
  } catch (e) {}

  $done({ body: JSON.stringify(json) });
})();
