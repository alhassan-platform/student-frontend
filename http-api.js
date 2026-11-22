(function (root) {
  'use strict';
  // No endpoint is built in. Configuration never contains a password, code or token.
  function createHttpApi(endpoint, dependencies) {
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint || '')) throw new Error('خادم المنصة غير مضبوط');
    var dep = dependencies || {}, request = dep.fetch || root.fetch.bind(root);
    var readOnly = new Set(['me','catalog','myCurriculum','lessons','lesson','mcq','myResults','hwStatus','bookStatus','bookGet']);
    var allowed = new Set([...readOnly, 'login','logout','submitMcq','uploadHomework','bookSync']);
    return new Proxy({}, { get: function (_, method) {
      if (method === 'then') return undefined;
      if (!allowed.has(method)) return undefined;
      return async function () {
        var args = Array.prototype.slice.call(arguments), attempts = 0;
        while (true) {
          var controller = new AbortController(), timer = setTimeout(function () { controller.abort(); }, dep.timeoutMs || (method === 'uploadHomework' ? 360000 : 120000));
          try {
            var response = await request(endpoint, { method: 'POST', mode: 'cors', credentials: 'omit', redirect: 'follow', referrerPolicy: 'no-referrer', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify({ protocol: 'student-http-v1', method: method, args: args }), signal: controller.signal });
            if (!response.ok) { var he = new Error('تعذّر الاتصال بالخادم'); he.status = response.status; throw he; }
            var contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) throw new Error('خادم المنصة لم يرجع بيانات صالحة. لا تستخدم صفحة تسجيل Google كخادم للطلاب.');
            var result = await response.json();
            if (!result || typeof result.ok !== 'boolean') throw new Error('استجابة غير صالحة');
            if (!result.ok) { var e = new Error(result.message || 'حصل خطأ'); e.status = result.status; throw e; }
            return result.data;
          } catch (error) {
            // Never retry writes. A timed-out write may have reached the server.
            if (readOnly.has(method) && attempts < 1 && (error instanceof TypeError || error.status === 429 || error.status === 500 || error.status === 503)) {
              attempts++; if (dep.pause) await dep.pause(); else await new Promise(function (r) { setTimeout(r, 1500); });
            } else throw error;
          } finally { clearTimeout(timer); }
        }
      };
    }});
  }
  root.PlatformHttp = { create: createHttpApi };
  if (typeof module !== 'undefined') module.exports = root.PlatformHttp;
})(typeof window !== 'undefined' ? window : globalThis);
