/**
 * Soul 去广告 —— 关注页顶部「推荐人」清理
 *
 * 类型：Loon http-response 脚本
 * 匹配：^https://post.soulapp.cn/v5/post/focused
 *
 * 抓包结论：
 *   关注页（PostSquare_Follow）的接口 /v5/post/focused 里除了 posts，
 *   还有两个字段用于在列表顶部/中间插入推荐内容：
 *     data.recUsers -> 推荐用户（也就是页面顶部的「推荐人」）
 *     data.recPosts -> 推荐帖子
 *   清空这两个数组，关注页就只剩自己关注的人的内容。
 *   另外顺手剔除 posts 里带广告标记的卡片（正常情况下没有，纯兜底）。
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

  if (Array.isArray(data.recUsers) && data.recUsers.length > 0) {
    data.recUsers = [];
    changed = true;
  }

  if (Array.isArray(data.recPosts) && data.recPosts.length > 0) {
    data.recPosts = [];
    changed = true;
  }

  if (Array.isArray(data.posts)) {
    var kept = [];
    for (var i = 0; i < data.posts.length; i++) {
      if (!isAdPost(data.posts[i])) kept.push(data.posts[i]);
    }
    if (kept.length !== data.posts.length) {
      data.posts = kept;
      changed = true;
    }
  }

  if (!changed) {
    $done({});
    return;
  }

  try {
    console.log("[SoulAds] 已移除关注页顶部推荐人 / 推荐内容");
  } catch (e) {}

  $done({ body: JSON.stringify(json) });
})();
