/**
 * Soul 去广告 —— 全局弹窗里的广告 / 商业化 / 增长弹窗（附加项）
 *
 * 类型：Loon http-response 脚本
 * 匹配：^https://api-a.soulapp.cn/soul/global/popup/(config|allConfig)
 *
 * 抓包结论：
 *   popup/allConfig 的 data 是「弹窗 bizCode -> 配置」字典（95 个），
 *   popup/config 的 data.popInfoList 是本次真正要弹的队列。
 *
 * 本脚本按组删除（改 REMOVE_PREFIXES / REMOVE_CODES 即可增减）：
 *   - AD_*    广告弹窗：AD_Interstitial 插屏、AD_Points 广告积分导流
 *   - UG_*    增长/拉活：签到、现金裂变、回流激励、付费到期提醒等 19 个
 *   - Meta_*  付费头像/头像续费 5 个
 *   - VAS 里明确卖东西/召回/低活引导的那几个（恋爱铃召回、超级星人续费、抖音支付礼包、
 *     低活语音/视频匹配弹窗），见 REMOVE_CODES
 *
 * 刻意保留（属于功能，不是广告）：
 *   VAS_VOICECALL_POPUPPUSH / VAS_VIDEOCALL_POPUPPUSH   来电弹窗
 *   VAS_VoiceMatchreserve / VAS_VoiceMatchTarget / VAS_VoiceMatchEmoplaymate
 *   Social_LoveBell / Social_LoveBellLBS               奇遇铃本体、位置引导
 *   ChatRoom_* / Square_* / Social_* 的其它功能引导
 */

(function () {
  // 按前缀整组删除（大小写不敏感）
  var REMOVE_PREFIXES = ["AD_", "UG_", "META_"];

  // 精确删除的 bizCode（统一转大写比较）
  var REMOVE_CODES = [
    // VAS 商业化 / 召回 / 低活引导
    "VAS_LOVEBELL",
    "VAS_LOVEBELLRECALL",
    "VAS_LOVEBELLCOMPENSATE",
    "VAS_SUPERSTARRENEWPOPUP",
    "VAS_SUPERMEMBER_POPUPPUSH",
    "VAS_DOUYINPAYGIFTPACK",
    "VAS_LOWPEAK_VOICEMATCH_POPUPWINDOW",
    "VAS_PLANET_LOWPEAK_VIDEOMATCH_POPUPWINDOW",
    "VAS_PLANET_LOWPEAK_AUDIOMATCH_POPUPWINDOW",
    // 奇遇铃主页推广卡（保留奇遇铃本体 Social_LoveBell）
    "SOCIAL_LOVEBELLRETURNGUIDECARD"
  ];

  function shouldRemove(code) {
    if (!code) return false;
    for (var i = 0; i < REMOVE_PREFIXES.length; i++) {
      if (code.indexOf(REMOVE_PREFIXES[i]) === 0) return true;
    }
    for (var j = 0; j < REMOVE_CODES.length; j++) {
      if (code === REMOVE_CODES[j]) return true;
    }
    return false;
  }

  function codeOf(obj) {
    if (!obj || typeof obj !== "object") return "";
    var raw = obj.bizCode || obj.bizcode || obj.code || "";
    return String(raw).toUpperCase();
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
  var removed = 0;

  // popup/config: { data: { popInfoList: [ { bizCode: "AD_Interstitial" } ] } }
  if (Array.isArray(data.popInfoList)) {
    var kept = [];
    for (var i = 0; i < data.popInfoList.length; i++) {
      var item = data.popInfoList[i];
      if (shouldRemove(codeOf(item))) {
        removed++;
      } else {
        kept.push(item);
      }
    }
    if (kept.length !== data.popInfoList.length) {
      data.popInfoList = kept;
      changed = true;
    }
  }

  // popup/allConfig: { data: { "AD_Interstitial": {...}, ... } }
  var keys = Object.keys(data);
  for (var j = 0; j < keys.length; j++) {
    var key = keys[j];
    if (shouldRemove(String(key).toUpperCase())) {
      delete data[key];
      removed++;
      changed = true;
    }
  }

  if (!changed) {
    $done({});
    return;
  }

  try {
    console.log("[SoulAds] 已移除 " + removed + " 个广告/商业化/增长弹窗");
  } catch (e) {}

  $done({ body: JSON.stringify(json) });
})();
