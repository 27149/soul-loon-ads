/**
 * Soul 去广告 —— 运营位 / 推荐位 / 广场弹窗 / 新人入口清理
 *
 * 类型：Loon http-response 脚本
 * 命中（同一脚本按 path 分支处理）：
 *   api-chat.soulapp.cn/chat/limitInfo                    私聊「打招呼/购买权益包」弹窗（limit 置 false）
 *   post.soulapp.cn/v2/rec/user                          顶部「猜你喜欢」推荐用户模块
 *   post.soulapp.cn/post/relationUser/chatRooms          语音房「猜你喜欢」推荐（30 条）
 *   post.soulapp.cn/hot/soul/rank                       热 Soul 榜（话题运营榜）
 *   post.soulapp.cn/post/recSquare/subTabResource       广场子 tab 运营位
 *   post.soulapp.cn/square/pop/window/switch            广场弹窗总开关
 *   post.soulapp.cn/tags/location/info/v2               同城页头图 banner
 *   api-user.soulapp.cn/homepage/diamond/position/info  「我」页头像下的服务入口行（Soul币中心/超级星人/个性商城…）整行清空
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
  } else if (/\/chat\/limitInfo$/.test(path)) {
    // 进入私聊时的「打招呼 / 购买权益包」弹窗：limit=true 时客户端弹推销框。
    // 抓包：limit:true + title「Ta正好在线…」+ subMsg「想认识你，从一朵花的问候开始」
    //       + bottomText「购买打招呼权益包…」；社区脚本的处理也是把 limit 置 false。
    if (data && typeof data === "object" && data.limit !== false) {
      data.limit = false;
      changed = true;
      note = "私聊打招呼限制弹窗";
    }
  } else if (/\/v2\/rec\/user$/.test(path)) {
    // 关注页/推荐页顶部的「猜你喜欢」推荐用户模块。
    // position 是插入位置，置 -1 让客户端不再插模块；同时把 data 里所有数组字段清空，
    // 不再依赖具体字段名（服务端偶尔换名）。每次都打一行日志，方便关抓包后在 Loon 日志里核对。
    try {
      console.log("[SoulAds] rec/user 原始: " + String(body).slice(0, 300));
    } catch (e) {}
    if (Array.isArray(json.data)) {
      if (json.data.length > 0) {
        json.data = [];
        changed = true;
      }
    } else if (data && typeof data === "object") {
      for (var uk in data) {
        if (Object.prototype.hasOwnProperty.call(data, uk) && Array.isArray(data[uk]) && data[uk].length > 0) {
          data[uk] = [];
          changed = true;
        }
      }
      if (data.position !== -1) {
        data.position = -1;
        changed = true;
      }
    }
    note = "推荐用户模块";
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
  } else if (/\/homepage\/diamond\/position\/info$/.test(path)) {
    // 「我」页头像下的服务入口行：data 是按钮数组（SOUL_COIN/SUPER_VIP/SHOP/GAME_CENTER…），整行清空。
    // 访客视角的 guestPosition/info 不在这里，不受影响。
    if (Array.isArray(json.data) && json.data.length > 0) {
      json.data = [];
      changed = true;
      note = "「我」页服务入口行";
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
