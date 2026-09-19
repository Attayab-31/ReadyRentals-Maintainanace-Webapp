(function (global) {
  const API_BASE = "";
  const TOKEN_KEY = "wo_access_token";

  function getAccessToken() {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  function setAccessToken(token) {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  }

  function recordDebug(entry) {
    global.__lastApi = entry;
    global.dispatchEvent(new CustomEvent("api:last", { detail: entry }));
  }

  async function parseBody(res) {
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  function formatError(status, body) {
    const payload = typeof body === "string" ? body : JSON.stringify(body, null, 2);
    const err = new Error(`HTTP ${status}`);
    err.status = status;
    err.body = body;
    err.raw = payload;
    return err;
  }

  async function api(method, path, opts) {
    opts = opts || {};
    const json = opts.json;
    const auth = opts.auth !== false;
    const extraHeaders = opts.headers || {};
    const url = `${API_BASE}${path}`;
    const headers = Object.assign({}, extraHeaders);
    if (auth && getAccessToken()) {
      headers.Authorization = `Bearer ${getAccessToken()}`;
    }
    const fetchOpts = { method: method, headers: headers };
    if (json !== undefined) {
      headers["Content-Type"] = "application/json";
      fetchOpts.body = JSON.stringify(json);
    }
    const res = await fetch(url, fetchOpts);
    const body = await parseBody(res);
    recordDebug({ method: method, url: url, status: res.status, ok: res.ok, body: body });
    if (!res.ok) throw formatError(res.status, body);
    return body;
  }

  async function apiUpload(path, file) {
    const url = `${API_BASE}${path}`;
    const form = new FormData();
    form.append("file", file, file.name || "photo.jpg");
    const res = await fetch(url, { method: "POST", body: form });
    const body = await parseBody(res);
    recordDebug({ method: "POST", url: url, status: res.status, ok: res.ok, body: body });
    if (!res.ok) throw formatError(res.status, body);
    return body;
  }

  async function apiBlob(method, path, opts) {
    opts = opts || {};
    const auth = opts.auth !== false;
    const url = `${API_BASE}${path}`;
    const headers = {};
    if (auth && getAccessToken()) {
      headers.Authorization = `Bearer ${getAccessToken()}`;
    }
    const res = await fetch(url, { method: method, headers: headers });
    recordDebug({
      method: method,
      url: url,
      status: res.status,
      ok: res.ok,
      body: res.ok ? "(binary)" : await parseBody(res.clone()),
    });
    if (!res.ok) throw formatError(res.status, await parseBody(res));
    return res.blob();
  }

  global.WOApi = {
    API_BASE: API_BASE,
    getAccessToken: getAccessToken,
    setAccessToken: setAccessToken,
    api: api,
    apiUpload: apiUpload,
    apiBlob: apiBlob,
  };
})(window);
