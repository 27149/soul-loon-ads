/**
 * Soul 去广告 —— 广告 SSP 拦截（开屏 + 信息流）
 *
 * 类型：Loon http-request 脚本
 * 匹配：^https://ssp.soulapp.cn/api/q
 *
 * 抓包结论（Soul 6.35.0 / iOS 27.0.1）：
 *   - 开屏广告、广场「推荐/关注」信息流、地图页信息流里的广告素材，全部由
 *     ssp.soulapp.cn/api/q 下发，响应 JSON 的 data.prs[] 才是广告列表。
 *   - 本次抓包里的一条真实广告（推荐信息流）：
 *       pageId = PostSquare_Recommend
 *       ideaId = 7819294
 *       adOwnerSignature = "壹心理"      <-- 广告主
 *       position = 10, positionType = 1
 *     关注信息流里的广告：
 *       pageId = PostSquare_Follow, adOwnerSignature = "泰鑫汇", position = 5
 *   - data.cnt 等于 prs 的条数，两者一起清零即可。
 *
 * 处理方式：
 *   在请求阶段直接合成一份「无广告」的 200 JSON 返回（cnt = 0），
 *   不产生真实广告请求，启动更快；响应是完整 JSON，SDK 不会因为解析失败反复重试。
 *   （社区里常见的做法是 URL Rewrite 直接 reject-dict，那会返回 {}，也能用，
 *     但少了 code/data 结构，个别版本 SDK 会打错误日志。）
 */

(function () {
  function pageIdOf(url) {
    var m = /[?&]pageId=([^&]*)/.exec(url || "");
    return m ? decodeURIComponent(m[1]) : "";
  }

  var emptyAdResponse = {
    code: 200,
    message: "",
    data: {
      reqId: "",
      cnt: 0,
      prs: [],
      prePrs: [],
      expr: {},
      frequencyResults: [],
      preLoadUrls: [],
      idid: "00000000-0000-0000-0000-000000000000",
      strategy: {
        timeout: 1,
        reqMode: 1,
        ads: [],
        adCount: 0,
        cacheCount: 0
      },
      biddings: [],
      extInfo: {}
    }
  };

  var body;
  try {
    body = JSON.stringify(emptyAdResponse);
  } catch (e) {
    // 极端情况下的兜底，保证仍是合法 JSON
    body = '{"code":200,"message":"","data":{"cnt":0,"prs":[],"prePrs":[]}}';
  }

  try {
    var pid = pageIdOf($request && $request.url);
    console.log("[SoulAds] 已拦截广告请求" + (pid ? "：" + pid : "") + "（返回空广告）");
  } catch (e) {}

  $done({
    response: {
      status: 200,
      headers: {
        "Content-Type": "application/json;charset=utf-8"
      },
      body: body
    }
  });
})();
