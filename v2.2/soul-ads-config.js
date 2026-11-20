/**
 * Soul 去广告 —— 开屏兜底 + 全页面商业化 Banner 开关
 *
 * 类型：Loon http-response 脚本
 * 命中（同一脚本按 path 分支处理）：
 *   api-a.soulapp.cn/api/open/guide-position/check     开屏引导位频控（强制 allow=false）
 *   increase-openapi.soulapp.cn/increase/startup/policy 启动策略/启动跳转（强制 result=false）
 *   api-a.soulapp.cn/app/landing/page/get             启动落地页（强制 null）
 *   api-ucc.soulapp.cn/app/apollo/config              全页面商业化 banner 开关
 *
 * 抓包依据：
 *   guide-position/check 返回 allow=false + VERSION_LIMIT_REACHED（版本频控上限）
 *   startup/policy 返回 result=false, type=null, jumpUrl=null
 *   apollo: new_commercial_banner_open="true"，global_banner_page_config 等挂了 20+ 页面，
 *           adStationConf.enable=1（广告 H5 落地页站）
 */

(function () {
  var url = ($request && $request.url) || "";

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

  var changed = false;
  var note = "";

  if (/\/api\/open\/guide-position\/check/.test(url)) {
    var gd = json.data;
    if (!gd || typeof gd !== "object") {
      gd = json.data = {};
    }
    if (gd.allow !== false) {
      gd.allow = false;
      if (!gd.rejectReasonCode) gd.rejectReasonCode = "VERSION_LIMIT_REACHED";
      if (!gd.rejectReasonMsg) gd.rejectReasonMsg = "达到版本频控上限";
      changed = true;
      note = "开屏引导位";
    }
  } else if (/\/increase\/startup\/policy/.test(url)) {
    var sd = json.data;
    if (!sd || typeof sd !== "object") {
      sd = json.data = {};
    }
    if (sd.result !== false) {
      sd.result = false;
      sd.type = null;
      sd.jumpUrl = null;
      changed = true;
      note = "启动跳转策略";
    }
  } else if (/\/app\/landing\/page\/get/.test(url)) {
    if (json.data !== null) {
      json.data = null;
      changed = true;
      note = "启动落地页";
    }
  } else if (/\/app\/apollo\/config/.test(url)) {
    var gc = json.data && json.data.globalConfig;
    if (gc && typeof gc === "object") {
      // 1) 关闭全页面商业化 banner，并清空挂载页面
      if (gc.new_commercial_banner_open !== "false") {
        gc.new_commercial_banner_open = "false";
        changed = true;
      }
      if (gc.global_banner_page_config !== "[]") {
        gc.global_banner_page_config = "[]";
        changed = true;
      }
      var emptyBanner = '{"app":[],"h5":[],"flutter":[],"rn":[]}';
      if (gc.global_banner_allPage_config !== emptyBanner) {
        gc.global_banner_allPage_config = emptyBanner;
        changed = true;
      }

      // 2) 关掉广告 H5 落地页站（值本身是一个 JSON 字符串）
      if (gc.adStationConf) {
        try {
          var station = JSON.parse(gc.adStationConf);
          if (station && typeof station === "object" && station.enable !== 0) {
            station.enable = 0;
            gc.adStationConf = JSON.stringify(station);
            changed = true;
          }
        } catch (e) {}
      }

      if (changed) note = "商业化 banner / 广告落地页站";
    }
  }

  if (!changed) {
    $done({});
    return;
  }

  try {
    console.log("[SoulAds] 已关闭" + (note || "配置项"));
  } catch (e) {}

  $done({ body: JSON.stringify(json) });
})();
