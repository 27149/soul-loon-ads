/**
 * Soul 去广告 —— 运营位 / 推荐位 / 广场弹窗 / 新人入口清理
 *
 * 类型：Loon http-response 脚本
 * 命中（同一脚本按 path 分支处理）：
 *   post.soulapp.cn/post/relationUser/chatRooms          语音房「猜你喜欢」推荐（30 条）
 *   post.soulapp.cn/hot/soul/rank                       热 Soul 榜（话题运营榜）
 *   post.soulapp.cn/post/recSquare/subTabResource       广场子 tab 运营位
 *   post.soulapp.cn/square/pop/window/switch            广场弹窗总开关
 *   post.soulapp.cn/tags/location/info/v2               同城页头图 banner
 *   api-user.soulapp.cn/furion/position/content        运营/引导位
 *   api-user.soulapp.cn/furion/position/refresh        运营/引导位
 *   api-user.soulapp.cn/newUser/task/getEntranceState  新人任务入口
 *   api-a.soulapp.cn/show/square/topicMatchCard         话题匹配付费卡 + 广场福袋卡
 *
 * 每一段都做了「有内容才改」判断：服务端本来就返回空时原样放行，不改响应。
 */

(function () {
  var url = ($request && $request.url) || "";
  var m = /^https?:\/\/[^/]+(\/[^?]*)/.exec(url);
  var path = m ? m[1] : "";

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
  var changed = false;
  var note = "";

  if (/\/post\/relationUser\/chatRooms$/.test(path)) {
    if (data && Array.isArray(data.userList) && data.userList.length > 0) {
      data.userList = [];
      changed = true;
      note = "语音房推荐";
    }
  } else if (/\/hot\/soul\/rank$/.test(path)) {
    if (Array.isArray(json.data) && json.data.length > 0) {
      json.data = [];
      changed = true;
      note = "热 Soul 榜";
    }
  } else if (/\/post\/recSquare\/subTabResource$/.test(path)) {
    if (data && Array.isArray(data.positionContentList) && data.positionContentList.length > 0) {
      data.positionContentList = [];
      changed = true;
      note = "广场运营位";
    }
  } else if (/\/square\/pop\/window\/switch$/.test(path)) {
    if (data && typeof data === "object" && data.popSwitch !== 0) {
      data.popSwitch = 0;
      changed = true;
      note = "广场弹窗开关";
    }
  } else if (/\/tags\/location\/info\/v2$/.test(path)) {
    if (data && typeof data === "object" && data.bannerModel) {
      delete data.bannerModel;
      changed = true;
      note = "同城头图 banner";
    }
  } else if (/\/furion\/position\/(content|refresh)$/.test(path)) {
    if (data && (!Array.isArray(data) || data.length > 0)) {
      json.data = [];
      changed = true;
      note = "运营位";
    }
  } else if (/\/newUser\/task\/getEntranceState$/.test(path)) {
    if (json.data !== null) {
      json.data = null;
      changed = true;
      note = "新人任务入口";
    }
  } else if (/\/show\/square\/topicMatchCard$/.test(path)) {
    if (data && typeof data === "object") {
      var card = data.topicMatchCard;
      if (card && (card.show !== false || card.paidCardInfo)) {
        card.show = false;
        card.paidCardInfo = null;
        changed = true;
      }
      if (data.squareLuckyBagCard && Object.keys(data.squareLuckyBagCard).length > 0) {
        data.squareLuckyBagCard = {};
        changed = true;
      }
      note = "话题付费卡/福袋卡";
    }
  }

  if (!changed) {
    $done({});
    return;
  }

  try {
    console.log("[SoulAds] 已清理" + (note || "运营位"));
  } catch (e) {}

  $done({ body: JSON.stringify(json) });
})();
