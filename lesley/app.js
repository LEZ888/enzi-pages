/* LESLEY公司仓储 — 单文件可运行版（React UMD + htm，无需 npm 构建）
   直接用浏览器打开 index.html 即可（手机/电脑均可）。
   数据默认存本地 IndexedDB；连接 GitHub 私有仓库后自动云端同步，换手机不丢。 */
(function () {
  'use strict';
  var React = window.React;
  var ReactDOM = window.ReactDOM;
  var htm = window.htm;
  var html = htm.bind(React.createElement);
  var useState = React.useState, useEffect = React.useEffect,
      useCallback = React.useCallback, useMemo = React.useMemo, useContext = React.useContext;

  /* ============ 错误边界（避免任何渲染异常导致整页空白）============ */
  class ErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { err: null }; }
    static getDerivedStateFromError(err) { return { err: err }; }
    componentDidCatch(err, info) { try { console.error('APP_ERROR', err, info && info.componentStack); } catch (e) {} }
    render() {
      if (this.state.err) {
        return html`<div style=${{ padding: '20px', color: '#c00', fontFamily: 'monospace' }}>
          <h3>页面出错了（已捕获，未崩溃）</h3>
          <pre style=${{ whiteSpace: 'pre-wrap', fontSize: '12px' }}>${String(this.state.err && (this.state.err.stack || this.state.err.message) || this.state.err)}</pre>
        </div>`;
      }
      return this.props.children;
    }
  }

  /* ============ 数据层（原生 IndexedDB） ============ */
  var DB_NAME = 'lesley-company-storage';
  var DB_VERSION = 2;
  var _dbPromise = null;
  function getDB() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        var db = req.result;
        var old = e.oldVersion || 0;
        if (!db.objectStoreNames.contains('modules')) db.createObjectStore('modules', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('categories')) {
          var s = db.createObjectStore('categories', { keyPath: 'id' });
          s.createIndex('byModule', 'moduleId');
        }
        if (!db.objectStoreNames.contains('items')) {
          var s2 = db.createObjectStore('items', { keyPath: 'id' });
          s2.createIndex('byModule', 'moduleId');
          s2.createIndex('byCategory', 'categoryId');
        }
        if (!db.objectStoreNames.contains('records')) {
          var s3 = db.createObjectStore('records', { keyPath: 'id' });
          s3.createIndex('byItem', 'itemId');
          s3.createIndex('byModule', 'moduleId');
          s3.createIndex('byTime', 'time');
        }
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return _dbPromise;
  }
  function req2p(request) {
    return new Promise(function (res, rej) { request.onsuccess = function () { res(request.result); }; request.onerror = function () { rej(request.error); }; });
  }
  function getAll(store) { return getDB().then(function (db) { return req2p(db.transaction(store, 'readonly').objectStore(store).getAll()); }); }
  function getOne(store, key) { return getDB().then(function (db) { return req2p(db.transaction(store, 'readonly').objectStore(store).get(key)); }); }
  function put(store, val) { return getDB().then(function (db) { return req2p(db.transaction(store, 'readwrite').objectStore(store).put(val)).then(function () { schedulePush(); return val; }); }); }
  function del(store, key) { return getDB().then(function (db) { return req2p(db.transaction(store, 'readwrite').objectStore(store).delete(key)).then(function () { schedulePush(); }); }); }
  function getAllByIndex(store, index, value) { return getDB().then(function (db) { return req2p(db.transaction(store, 'readonly').objectStore(store).index(index).getAll(value)); }); }

  var DEFAULT_MODULES = [
    { id: 'm1', name: '成品区', order: 1 }, { id: 'm2', name: '半成品区', order: 2 },
    { id: 'm3', name: '包材区', order: 3 }, { id: 'm4', name: '盒子区', order: 4 },
    { id: 'm5', name: '标签区', order: 5 }, { id: 'm6', name: '配件区', order: 6 },
    { id: 'm7', name: '其他区', order: 7 }, { id: 'm8', name: '工具区', order: 8 },
    { id: 'm9', name: '杂物区', order: 9 }
  ];
  function ensureSeed() {
    return getAll('modules').then(function (list) {
      if (list.length === 0) { return Promise.all(DEFAULT_MODULES.map(function (m) { return put('modules', m); })); }
    });
  }
  function getModules() { return getAll('modules').then(function (l) { return l.sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); }); }
  function getCategories(moduleId) { return moduleId ? getAllByIndex('categories', 'byModule', moduleId) : getAll('categories'); }
  function addCategory(moduleId, name) {
    var cat = { id: uid('c'), moduleId: moduleId, name: (name || '').trim(), createdAt: Date.now() };
    return put('categories', cat);
  }
  function renameCategory(catId, name) { return getOne('categories', catId).then(function (c) { if (!c) return; c.name = (name || '').trim(); return put('categories', c); }); }
  function deleteCategory(catId) { return del('categories', catId); }

  function addModule(name) {
    return getAll('modules').then(function (list) {
      var maxOrder = 0; list.forEach(function (m) { if ((m.order || 0) > maxOrder) maxOrder = m.order; });
      var mod = { id: uid('m'), name: (name || '').trim(), order: maxOrder + 1, createdAt: Date.now() };
      return put('modules', mod);
    });
  }
  function renameModule(id, name) { return getOne('modules', id).then(function (m) { if (!m) return; m.name = (name || '').trim(); return put('modules', m); }); }
  function deleteModule(id) {
    return Promise.all([
      getAllByIndex('categories', 'byModule', id),
      getAllByIndex('items', 'byModule', id),
      getAllByIndex('records', 'byModule', id)
    ]).then(function (a) {
      return getDB().then(function (db) {
        return new Promise(function (res) {
          var tx = db.transaction(['modules', 'categories', 'items', 'records'], 'readwrite');
          tx.objectStore('modules').delete(id);
          a[0].forEach(function (c) { tx.objectStore('categories').delete(c.id); });
          a[1].forEach(function (i) { tx.objectStore('items').delete(i.id); });
          a[2].forEach(function (r) { tx.objectStore('records').delete(r.id); });
          tx.oncomplete = function () { schedulePush(); res(); };
        });
      });
    });
  }

  function getItems(moduleId) { return moduleId ? getAllByIndex('items', 'byModule', moduleId) : getAll('items'); }
  function getItem(id) { return getOne('items', id); }
  function createItem(data) {
    var now = Date.now();
    var item = {
      id: uid('i'), moduleId: data.moduleId, categoryId: data.categoryId || null, name: data.name,
      quantity: data.quantity || 0, location: data.location || '', purposeNote: data.purposeNote || '',
      supplierNote: data.supplierNote || '', arrivalDate: data.arrivalDate || '', expiryDate: data.expiryDate || '',
      remindDays: (data.remindDays == null ? 7 : data.remindDays), images: data.images || [], videos: data.videos || [],
      createdAt: now, updatedAt: now
    };
    var rec = { id: uid('r'), itemId: item.id, moduleId: item.moduleId, categoryId: item.categoryId, itemName: item.name, opType: 'in', qty: item.quantity, note: '初始入库', time: now, remaining: item.quantity };
    return Promise.all([put('items', item), put('records', rec)]).then(function () { return item; });
  }
  function updateItem(item) { item.updatedAt = Date.now(); return put('items', item); }
  function deleteItem(id) {
    return getAllByIndex('records', 'byItem', id).then(function (recs) {
      return Promise.all([del('items', id)].concat(recs.map(function (r) { return del('records', r.id); })));
    });
  }
  function adjustQuantity(itemId, opt) {
    return getItem(itemId).then(function (item) {
      if (!item) throw new Error('物品不存在');
      var before = item.quantity || 0, after = before, opType = opt.type, delta = opt.qty;
      if (opt.type === 'in') after = before + opt.qty;
      else if (opt.type === 'out') after = before - opt.qty;
      else if (opt.type === 'consume') after = before - opt.qty;
      else if (opt.type === 'set') { after = opt.qty; delta = opt.qty - before; opType = delta >= 0 ? 'in' : 'out'; }
      if (after < 0) after = 0;
      item.quantity = after; item.updatedAt = Date.now();
      var rec = { id: uid('r'), itemId: item.id, moduleId: item.moduleId, categoryId: item.categoryId, itemName: item.name, opType: opt.type === 'consume' ? 'consume' : opType, qty: Math.abs(delta || opt.qty), note: opt.type === 'set' ? (opt.note || '直接修改数量') : (opt.note || ''), time: Date.now(), remaining: after };
      return Promise.all([put('items', item), put('records', rec)]).then(function () { return { item: item, record: rec }; });
    });
  }
  function consumeItem(itemId, qty, note) {
    return getItem(itemId).then(function (item) {
      if (!item) throw new Error('物品不存在');
      if ((item.quantity || 0) < qty) throw new Error('库存不足（当前 ' + (item.quantity || 0) + '）');
      return adjustQuantity(itemId, { type: 'consume', qty: qty, note: note || '消耗登记' });
    });
  }
  function getRecords(filters) {
    filters = filters || {};
    return (filters.itemId ? getAllByIndex('records', 'byItem', filters.itemId)
      : filters.moduleId ? getAllByIndex('records', 'byModule', filters.moduleId)
      : getAll('records')).then(function (list) {
      list.sort(function (a, b) { return b.time - a.time; });
      if (filters.from != null || filters.to != null) {
        list = list.filter(function (r) { return (filters.from == null || r.time >= filters.from) && (filters.to == null || r.time <= filters.to); });
      }
      if (filters.opType) list = list.filter(function (r) { return r.opType === filters.opType; });
      return list;
    });
  }
  function clearAll() {
    return Promise.all([getAll('modules'), getAll('categories'), getAll('items'), getAll('records')]).then(function () {
      return getDB().then(function (db) {
        return new Promise(function (res) {
          var tx = db.transaction(['modules', 'categories', 'items', 'records'], 'readwrite');
          tx.objectStore('modules').clear(); tx.objectStore('categories').clear();
          tx.objectStore('items').clear(); tx.objectStore('records').clear();
          tx.oncomplete = function () { schedulePush(); ensureSeed().then(res); };
        });
      });
    });
  }
  function exportAll() {
    return Promise.all([getAll('modules'), getAll('categories'), getAll('items'), getAll('records')]).then(function (a) {
      return { _app: 'LESLEY公司仓储', _version: DB_VERSION, _exportedAt: new Date().toISOString(), modules: a[0], categories: a[1], items: a[2], records: a[3] };
    });
  }
  function importAll(data, opts) {
    opts = opts || {};
    return getDB().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction(['modules', 'categories', 'items', 'records'], 'readwrite');
        if (!opts.merge) {
          tx.objectStore('modules').clear(); tx.objectStore('categories').clear();
          tx.objectStore('items').clear(); tx.objectStore('records').clear();
        }
        (data.modules || []).forEach(function (m) { tx.objectStore('modules').put(m); });
        (data.categories || []).forEach(function (c) { tx.objectStore('categories').put(c); });
        (data.items || []).forEach(function (i) { tx.objectStore('items').put(i); });
        (data.records || []).forEach(function (r) { tx.objectStore('records').put(r); });
        tx.oncomplete = function () { schedulePush(); res(); };
        tx.onerror = function () { rej(tx.error); };
      });
    });
  }
  function uid(p) { return (p || '') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  /* ============ 导出格式化 ============ */
  function escapeCSV(s) {
    if (s == null) return '';
    var str = String(s).replace(/"/g, '""');
    if (/[",\n\r]/.test(str)) str = '"' + str + '"';
    return str;
  }
  function exportCSV(data) {
    var lines = [];
    lines.push(['区域', '分类', '物品名称', '数量', '位置', '到货日期', '到期日期', '提前提醒', '用途备注', '供应商'].map(escapeCSV).join(','));
    data.items.forEach(function (it) {
      var mod = data.modules.find(function (m) { return m.id === it.moduleId; });
      var cat = data.categories.find(function (c) { return c.id === it.categoryId; });
      lines.push([
        mod ? mod.name : '', cat ? cat.name : '', it.name, it.quantity, it.location,
        it.arrivalDate, it.expiryDate, it.remindDays, it.purposeNote, it.supplierNote
      ].map(escapeCSV).join(','));
    });
    lines.push('');
    lines.push(['时间', '类型', '区域', '分类', '物品', '数量', '剩余', '备注'].map(escapeCSV).join(','));
    data.records.slice().sort(function (a, b) { return b.time - a.time; }).forEach(function (r) {
      var mod = data.modules.find(function (m) { return m.id === r.moduleId; });
      var cat = data.categories.find(function (c) { return c.id === r.categoryId; });
      var type = r.opType === 'in' ? '入库' : r.opType === 'out' ? '出库' : '消耗';
      lines.push([new Date(r.time).toLocaleString('zh-CN'), type, mod ? mod.name : '', cat ? cat.name : '', r.itemName, r.qty, r.remaining, r.note].map(escapeCSV).join(','));
    });
    return '\uFEFF' + lines.join('\n');
  }
  function exportHTML(data) {
    var rows = data.items.map(function (it) {
      var mod = data.modules.find(function (m) { return m.id === it.moduleId; });
      var cat = data.categories.find(function (c) { return c.id === it.categoryId; });
      return '<tr><td>' + [mod ? mod.name : '', cat ? cat.name : '', escapeHTML(it.name), it.quantity, escapeHTML(it.location), it.arrivalDate || '—', it.expiryDate || '—', it.remindDays, escapeHTML(it.purposeNote), escapeHTML(it.supplierNote)].join('</td><td>') + '</td></tr>';
    }).join('');
    var recRows = data.records.slice().sort(function (a, b) { return b.time - a.time; }).map(function (r) {
      var mod = data.modules.find(function (m) { return m.id === r.moduleId; });
      var cat = data.categories.find(function (c) { return c.id === r.categoryId; });
      var type = r.opType === 'in' ? '入库' : r.opType === 'out' ? '出库' : '消耗';
      return '<tr><td>' + [new Date(r.time).toLocaleString('zh-CN'), type, mod ? mod.name : '', cat ? cat.name : '', escapeHTML(r.itemName), r.qty, r.remaining, escapeHTML(r.note)].join('</td><td>') + '</td></tr>';
    }).join('');
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>LESLEY公司仓储 备份</title><style>body{font-family:system-ui,-apple-system,sans-serif;background:#fff9ed;color:#5d4e37;padding:20px}table{border-collapse:collapse;width:100%;margin-bottom:20px;background:#fff;border-radius:10px;overflow:hidden}th,td{padding:8px 10px;border-bottom:1px solid #f0e6d3;text-align:left;font-size:13px}th{background:#a7d7c5;color:#fff}</style></head><body><h2>LESLEY公司仓储 — 物品清单</h2><table><thead><tr><th>区域</th><th>分类</th><th>物品</th><th>数量</th><th>位置</th><th>到货</th><th>到期</th><th>提醒</th><th>用途</th><th>供应商</th></tr></thead><tbody>' + rows + '</tbody></table><h2>出入库 / 消耗记录</h2><table><thead><tr><th>时间</th><th>类型</th><th>区域</th><th>分类</th><th>物品</th><th>数量</th><th>剩余</th><th>备注</th></tr></thead><tbody>' + recRows + '</tbody></table></body></html>';
  }
  function escapeHTML(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* ============ 云端同步（GitHub 私有仓库，换手机不丢数据） ============ */
  var SYNC_KEY_TOKEN = 'lesley_gh_token';
  var SYNC_KEY_USER = 'lesley_gh_user';
  var SYNC_KEY_REPO = 'lesley_gh_repo';
  var SYNC_KEY_ENABLED = 'lesley_cloud_enabled';
  var SYNC_DATA_FILE = 'lesley-data.json';

  function ghHeaders(token) {
    return { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json', 'User-Agent': 'lesley-app' };
  }
  function ghApi(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign(ghHeaders(ghToken()), opts.headers || {});
    return fetch('https://api.github.com' + path, opts).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error(r.status + ' ' + t.slice(0, 220)); });
      var ct = r.headers.get('content-type') || '';
      return ct.indexOf('application/json') >= 0 ? r.json() : r.text();
    });
  }
  function ghToken() { return localStorage.getItem(SYNC_KEY_TOKEN) || ''; }
  function ghUser() { return localStorage.getItem(SYNC_KEY_USER) || ''; }
  function ghRepo() { return localStorage.getItem(SYNC_KEY_REPO) || 'lesley-data'; }
  function cloudEnabled() { return localStorage.getItem(SYNC_KEY_ENABLED) === '1'; }

  var _syncState = { status: 'idle', msg: '', lastSync: 0 };
  var _syncListeners = [];
  function setSyncState(patch) {
    Object.assign(_syncState, patch);
    _syncListeners.forEach(function (fn) { fn(_syncState); });
  }
  function onSyncState(fn) { _syncListeners.push(fn); }
  function getSyncState() { return _syncState; }

  function b64enc(str) { return btoa(unescape(encodeURIComponent(str))); }
  function b64dec(str) { return decodeURIComponent(escape(atob(str.replace(/\s/g, '')))); }

  var _pushTimer = null;
  function schedulePush() {
    if (!cloudEnabled()) return;
    if (_pushTimer) clearTimeout(_pushTimer);
    _pushTimer = setTimeout(doPush, 1600);
  }
  function doPush() {
    if (!cloudEnabled()) return;
    setSyncState({ status: 'syncing', msg: '正在同步到云端…' });
    var user = ghUser(), repo = ghRepo();
    exportAll().then(function (data) {
      return ghApi('/repos/' + user + '/' + repo + '/contents/' + SYNC_DATA_FILE).then(function (file) {
        var content = b64enc(JSON.stringify(data, null, 2));
        var msg = 'lesley sync ' + new Date().toLocaleString('zh-CN');
        return ghApi('/repos/' + user + '/' + repo + '/contents/' + SYNC_DATA_FILE, {
          method: 'PUT',
          body: JSON.stringify({ message: msg, content: content, sha: file && file.sha ? file.sha : undefined })
        });
      }, function (err) {
        if (err.message.indexOf('404') === 0) {
          var content = b64enc(JSON.stringify(data, null, 2));
          return ghApi('/repos/' + user + '/' + repo + '/contents/' + SYNC_DATA_FILE, {
            method: 'PUT',
            body: JSON.stringify({ message: 'lesley initial sync', content: content })
          });
        }
        throw err;
      });
    }).then(function () {
      setSyncState({ status: 'ok', msg: '已同步到云端', lastSync: Date.now() });
    }).catch(function (e) {
      setSyncState({ status: 'error', msg: '同步失败：' + e.message });
    });
  }
  function getCloudFile() {
    return ghApi('/repos/' + ghUser() + '/' + ghRepo() + '/contents/' + SYNC_DATA_FILE).catch(function (err) {
      if (err.message.indexOf('404') === 0) return null;
      throw err;
    });
  }
  function pullFromCloud() {
    if (!cloudEnabled()) return Promise.resolve();
    setSyncState({ status: 'syncing', msg: '正在从云端恢复…' });
    return getCloudFile().then(function (file) {
      if (!file) { setSyncState({ status: 'ok', msg: '云端暂无数据', lastSync: Date.now() }); return; }
      var data = JSON.parse(b64dec(file.content));
      return importAll(data, { merge: false }).then(function () {
        if (window.__reload) window.__reload();
        setSyncState({ status: 'ok', msg: '已从云端恢复', lastSync: Date.now() });
      });
    }).catch(function (e) {
      setSyncState({ status: 'error', msg: '恢复失败：' + e.message });
    });
  }
  function ensureRepo(user, repo, token) {
    return fetch('https://api.github.com/repos/' + user + '/' + repo, { headers: ghHeaders(token) }).then(function (r) {
      if (r.ok) return r.json();
      if (r.status === 404) {
        return fetch('https://api.github.com/user/repos', {
          method: 'POST', headers: ghHeaders(token),
          body: JSON.stringify({ name: repo, private: true, description: 'LESLEY公司仓储云端数据（自动同步，勿手动编辑）', auto_init: true })
        }).then(function (r2) {
          if (!r2.ok) return r2.text().then(function (t) { throw new Error(r2.status + ' ' + t.slice(0, 220)); });
          return r2.json();
        });
      }
      return r.text().then(function (t) { throw new Error(r.status + ' ' + t.slice(0, 220)); });
    });
  }
  function testAuth(token) {
    return fetch('https://api.github.com/user', { headers: ghHeaders(token) }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error('Token 无效：' + r.status + ' ' + t.slice(0, 220)); });
      return r.json();
    });
  }
  function connectCloud(user, token, repo) {
    repo = (repo || 'lesley-data').trim();
    user = user.trim(); token = token.trim();
    localStorage.setItem(SYNC_KEY_USER, user);
    localStorage.setItem(SYNC_KEY_TOKEN, token);
    localStorage.setItem(SYNC_KEY_REPO, repo);
    setSyncState({ status: 'syncing', msg: '正在连接云端…' });
    return testAuth(token).then(function (u) {
      if (u.login.toLowerCase() !== user.toLowerCase()) throw new Error('用户名与 Token 不匹配');
      return ensureRepo(user, repo, token);
    }).then(function () {
      return getCloudFile();
    }).then(function (file) {
      localStorage.setItem(SYNC_KEY_ENABLED, '1');
      if (file) {
        if (window.confirm('云端已存在备份数据。点「确定」用云端覆盖本机；点「取消」把本机数据上传到云端。')) {
          return pullFromCloud();
        } else {
          return doPush();
        }
      } else {
        return doPush();
      }
    });
  }
  function disconnectCloud() {
    localStorage.setItem(SYNC_KEY_ENABLED, '0');
    localStorage.removeItem(SYNC_KEY_TOKEN);
    setSyncState({ status: 'idle', msg: '已断开云端同步', lastSync: 0 });
  }

  /* ============ 工具 ============ */
  function fmtDate(s) { if (!s) return '—'; var d = new Date(s); if (isNaN(d.getTime())) return s; var p = function (n) { return String(n).padStart(2, '0'); }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  function daysBetween(a, b) { return Math.round((a - b) / 86400000); }
  function expiryStatus(item) {
    if (!item.expiryDate) return null;
    var exp = new Date(item.expiryDate); if (isNaN(exp.getTime())) return null;
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var d = daysBetween(exp, today); var rd = item.remindDays == null ? 7 : item.remindDays;
    if (d < 0) return { level: 'overdue', label: '已过期' + (-d) + '天' };
    if (d <= rd) return { level: 'soon', label: '剩' + d + '天' };
    return { level: 'ok', label: '剩' + d + '天' };
  }
  function fileToDataUrl(file) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; r.readAsDataURL(file); });
  }
  function navigate(p) { location.hash = p; }
  function parseHash() {
    var h = (location.hash || '').replace(/^#/, '');
    if (!h || h === '/') return { path: '/' };
    var m;
    if ((m = h.match(/^\/module\/([^/]+)$/))) return { path: '/module', moduleId: m[1] };
    if ((m = h.match(/^\/item\/new\/([^/]+)$/))) return { path: '/item/new', moduleId: m[1] };
    if ((m = h.match(/^\/item\/edit\/([^/]+)$/))) return { path: '/item/edit', itemId: m[1] };
    if ((m = h.match(/^\/item\/([^/]+)$/))) return { path: '/item', itemId: m[1] };
    if (h === '/records') return { path: '/records' };
    if (h === '/consume') return { path: '/consume' };
    if (h === '/search') return { path: '/search' };
    if (h === '/backup') return { path: '/backup' };
    if (h === '/settings') return { path: '/settings' };
    return { path: '/' };
  }

  /* ============ 全局状态 ============ */
  var AppCtx = React.createContext(null);
  function useStore() { return useContext(AppCtx); }

  function App() {
    var _a = useState([]), modules = _a[0], setModules = _a[1];
    var _b = useState([]), categories = _b[0], setCategories = _b[1];
    var _c = useState([]), items = _c[0], setItems = _c[1];
    var _d = useState([]), records = _d[0], setRecords = _d[1];
    var _e = useState(true), loading = _e[0], setLoading = _e[1];
    var _f = useState(''), toast = _f[0], setToast = _f[1];
    var _g = useState(false), overlay = _g[0], setOverlay = _g[1];
    var _h = useState(''), overlaySrc = _h[0], setOverlaySrc = _h[1];

    var reload = useCallback(function () {
      return Promise.all([getModules(), getAll('categories'), getAll('items'), getAll('records')]).then(function (a) {
        setModules(a[0]); setCategories(a[1]); setItems(a[2]); setRecords(a[3]); setLoading(false);
      });
    }, []);
    var toastFn = useCallback(function (m) { setToast(m); setTimeout(function () { setToast(''); }, 2200); }, []);
    var showImg = useCallback(function (src) { setOverlaySrc(src); setOverlay(true); }, []);

    useEffect(function () {
      window.__reload = reload;
      ensureSeed().then(reload).then(function () {
        if (cloudEnabled()) pullFromCloud();
      });
    }, []);

    var store = { modules: modules, categories: categories, items: items, records: records, reload: reload, toast: toastFn, showImg: showImg };
    if (loading) return html`<div class="loading">加载中…</div>`;
    return html`
      <${AppCtx.Provider} value=${store}>
        <${Router}/>
        ${toast ? html`<div class="toast">${toast}</div>` : null}
        ${overlay ? html`<div class="img-overlay" onClick=${function () { setOverlay(false); }}>
          <img src=${overlaySrc} onClick=${function (e) { e.stopPropagation(); }} />
          <div class="img-overlay-tip">点击空白处关闭</div>
        </div>` : null}
      <//>`;
  }

  function Router() {
    var _a = useState(parseHash()), route = _a[0], setRoute = _a[1];
    useEffect(function () {
      var on = function () { setRoute(parseHash()); window.scrollTo(0, 0); };
      window.addEventListener('hashchange', on);
      return function () { window.removeEventListener('hashchange', on); };
    }, []);
    var showTabs = ['/', '/records', '/consume', '/search', '/backup', '/settings'].indexOf(route.path) >= 0;
    var main;
    if (route.path === '/') main = html`<${Home}/>`;
    else if (route.path === '/module') main = html`<${ModulePage} moduleId=${route.moduleId}/>`;
    else if (route.path === '/item/new') main = html`<${ItemForm} moduleId=${route.moduleId}/>`;
    else if (route.path === '/item/edit') main = html`<${ItemForm} itemId=${route.itemId}/>`;
    else if (route.path === '/item') main = html`<${ItemDetail} itemId=${route.itemId}/>`;
    else if (route.path === '/records') main = html`<${Records}/>`;
    else if (route.path === '/consume') main = html`<${ConsumptionPage}/>`;
    else if (route.path === '/search') main = html`<${SearchPage}/>`;
    else if (route.path === '/backup') main = html`<${Backup}/>`;
    else if (route.path === '/settings') main = html`<${Settings}/>`;
    else main = html`<${Home}/>`;

    return html`
      <div class="app">
        ${showTabs ? html`<${Header} route=${route}/>` : html`<${SubHeader} route=${route}/>`}
        <div class="content">${main}</div>
        ${showTabs ? html`<${BottomTabs} route=${route}/>` : null}
      </div>`;
  }

  function Header() {
    return html`<header class="topbar"><div class="brand">LESLEY公司仓储</div></header>`;
  }
  function BottomTabs(props) {
    var TABS = [
      { path: '/', label: '首页', icon: '🏠' }, { path: '/consume', label: '消耗', icon: '📦' },
      { path: '/records', label: '记录', icon: '📊' }, { path: '/search', label: '搜索', icon: '🔍' },
      { path: '/settings', label: '设置', icon: '⚙️' }
    ];
    return html`<nav class="bottom-tabs">
      ${TABS.map(function (t) {
        return html`<button key=${t.path} class=${'tab' + (props.route.path === t.path ? ' active' : '')} onClick=${function () { navigate(t.path); }}>
          <span class="tab-ico">${t.icon}</span><span class="tab-tx">${t.label}</span>
        </button>`;
      })}
    </nav>`;
  }
  function SubHeader(props) {
    var title = '详情';
    if (props.route.path === '/module') title = '区域';
    else if (props.route.path === '/item/new' || props.route.path === '/item/edit') title = '物品';
    else if (props.route.path === '/item') title = '物品详情';
    return html`
      <header class="subbar">
        <button class="back" onClick=${function () { history.back(); }}>‹ 返回</button>
        <div class="subtitle">${title}</div>
        <div class="subspacer"></div>
      </header>`;
  }

  /* ============ 首页 ============ */
  function Home() {
    var s = useStore();
    var _m = useState(false), showManage = _m[0], setShowManage = _m[1];
    var _q = useState(false), showQuick = _q[0], setShowQuick = _q[1];
    var _newMod = useState(''), newMod = _newMod[0], setNewMod = _newMod[1];

    var reminders = useMemo(function () {
      return s.items.map(function (it) { return { it: it, st: expiryStatus(it) }; })
        .filter(function (o) { return o.st && (o.st.level === 'overdue' || o.st.level === 'soon'); })
        .sort(function (a, b) { return (a.st.level === 'overdue' ? -1 : 1) - (b.st.level === 'overdue' ? -1 : 1) || a.it.expiryDate.localeCompare(b.it.expiryDate); });
    }, [s.items]);
    var totalItems = s.items.length;
    var totalRecords = s.records.length;

    function doAddModule() {
      var name = newMod.trim(); if (!name) return;
      addModule(name).then(function () { setNewMod(''); s.reload(); s.toast('已添加区域'); });
    }
    function doRename(m) { var n = window.prompt('重命名区域', m.name); if (n && n.trim()) renameModule(m.id, n).then(s.reload); }
    function doDel(m) {
      var cnt = s.items.filter(function (it) { return it.moduleId === m.id; }).length;
      var msg = cnt ? '删除区域「' + m.name + '」会同时删除该区域下 ' + cnt + ' 个物品及全部记录，确定吗？' : '确定删除空区域「' + m.name + '」吗？';
      if (window.confirm(msg)) deleteModule(m.id).then(function () { s.reload(); s.toast('已删除区域'); });
    }

    return html`
      <div class="home">
        <div class="stat-row">
          <div class="stat"><div class="stat-n">${totalItems}</div><div class="stat-l">物品总数</div></div>
          <div class="stat"><div class="stat-n">${s.modules.length}</div><div class="stat-l">区域数</div></div>
          <div class="stat"><div class="stat-n">${totalRecords}</div><div class="stat-l">出入库记录</div></div>
        </div>

        <div class="home-actions">
          <button class="btn-ghost" onClick=${function () { setShowManage(true); }}>⚙️ 管理区域</button>
          <button class="btn-primary" onClick=${function () { setShowQuick(true); }}>＋ 快速添加</button>
        </div>

        ${reminders.length ? html`
          <div class="card remind-card">
            <div class="card-title">⏰ 到期提醒（${reminders.length}）</div>
            ${reminders.slice(0, 8).map(function (o) {
              return html`<div key=${o.it.id} class=${'remind-item ' + o.st.level} onClick=${function () { navigate('/item/' + o.it.id); }}>
                <div class="remind-name">${o.it.name}</div>
                <div class="remind-meta">${moduleNameOf(s.modules, o.it.moduleId)} · 到期 ${fmtDate(o.it.expiryDate)}</div>
                <div class=${'badge ' + o.st.level}>${o.st.label}</div>
              </div>`;
            })}
          </div>` : null}

        <div class="card-title" style=${{ marginTop: '14px' }}>📦 区域</div>
        <div class="module-grid">
          ${s.modules.map(function (m, idx) {
            var cnt = s.items.filter(function (it) { return it.moduleId === m.id; }).length;
            var colors = ['c-red','c-blue','c-green','c-yellow','c-purple','c-orange','c-teal','c-pink','c-brown'];
            return html`<button key=${m.id} class=${'module-card ' + colors[idx % colors.length]} onClick=${function () { navigate('/module/' + m.id); }}>
              <div class="mc-name">${m.name}</div>
              <div class="mc-count">${cnt} 件</div>
            </button>`;
          })}
        </div>

        <div class="consume-banner" onClick=${function () { navigate('/consume'); }}>
          <div class="cb-ico">📦</div>
          <div style=${{ flex: 1 }}>
            <div class="cb-title">每日消耗登记</div>
            <div class="cb-sub">快速搜索或按区域选择物品并扣减库存</div>
          </div>
          <div style=${{ fontSize: '20px' }}>›</div>
        </div>

        <div class="footer-note">${cloudEnabled() ? '✅ 已开启云端同步（GitHub 私有仓库），换手机后安装应用并输入同一 Token 即可恢复。' : '数据默认保存在本机浏览器。到「设置」开启 GitHub 云端同步后，换手机不丢数据。'}</div>

        ${showManage ? html`<${ModuleManageSheet} modules=${s.modules} newMod=${newMod} setNewMod=${setNewMod} onAdd=${doAddModule} onRename=${doRename} onDelete=${doDel} onClose=${function () { setShowManage(false); }}/>` : null}
        ${showQuick ? html`<${QuickAddSheet} modules=${s.modules} categories=${s.categories} onClose=${function () { setShowQuick(false); }}/>` : null}
      </div>`;
  }

  function ModuleManageSheet(props) {
    return html`
      <div class="sheet-mask" onClick=${props.onClose}>
        <div class="sheet" onClick=${function (e) { e.stopPropagation(); }}>
          <div class="sheet-title">管理区域</div>
          <div class="cat-add">
            <input class="inp" placeholder="新区域名称" value=${props.newMod} onInput=${function (e) { props.setNewMod(e.target.value); }} />
            <button class="btn-primary" onClick=${props.onAdd}>添加</button>
          </div>
          <div class="cat-manage-list">
            ${props.modules.length === 0 ? html`<div class="empty">暂无区域</div>` :
              props.modules.map(function (m) {
                return html`<div key=${m.id} class="cat-manage-item">
                  <span>${m.name}</span>
                  <span class="row-btns">
                    <button class="btn-mini" onClick=${function () { props.onRename(m); }}>改名</button>
                    <button class="btn-mini danger" onClick=${function () { props.onDelete(m); }}>删除</button>
                  </span>
                </div>`;
              })}
          </div>
          <button class="btn-block" onClick=${props.onClose}>完成</button>
        </div>
      </div>`;
  }

  function QuickAddSheet(props) {
    var s = useStore();
    var editMode = false;
    var _f = useState(null), form = _f[0], setForm = _f[1];
    var _loaded = useState(false), loaded = _loaded[0], setLoaded = _loaded[1];
    useEffect(function () {
      setForm({
        moduleId: props.modules[0] ? props.modules[0].id : '', categoryId: '', name: '', quantity: 0, location: '',
        purposeNote: '', supplierNote: '', arrivalDate: '', expiryDate: '', remindDays: 7,
        images: [], videos: []
      });
      setLoaded(true);
    }, []);
    if (!loaded || !form) return html`<div class="loading">加载中…</div>`;
    var cats = s.categories.filter(function (c) { return c.moduleId === form.moduleId; });
    function set(k, v) { setForm(Object.assign({}, form, ((typeof k === 'string') ? (function (o) { o[k] = v; return o; })({}) : k))); }
    function onPick(e, kind) {
      var files = e.target.files; if (!files || !files.length) return;
      Promise.all(Array.prototype.slice.call(files).map(function (f) { return fileToDataUrl(f); })).then(function (urls) {
        if (kind === 'image') set('images', form.images.concat(urls));
        else set('videos', form.videos.concat(urls));
      });
      e.target.value = '';
    }
    function removeImg(i) { var a = form.images.slice(); a.splice(i, 1); set('images', a); }
    function removeVid(i) { var a = form.videos.slice(); a.splice(i, 1); set('videos', a); }
    function save() {
      if (!form.moduleId) { s.toast('请选择所属区域'); return; }
      if (!form.name || !form.name.trim()) { s.toast('请填写物品名称'); return; }
      var q = parseInt(form.quantity, 10); if (isNaN(q)) q = 0;
      var rd = parseInt(form.remindDays, 10); if (isNaN(rd) || rd < 0) rd = 7;
      var data = {
        moduleId: form.moduleId, categoryId: form.categoryId || null, name: form.name.trim(), quantity: q,
        location: form.location, purposeNote: form.purposeNote, supplierNote: form.supplierNote,
        arrivalDate: form.arrivalDate, expiryDate: form.expiryDate, remindDays: rd,
        images: form.images, videos: form.videos
      };
      createItem(data).then(function () { s.reload(); s.toast('已添加'); props.onClose(); });
    }
    return html`
      <div class="sheet-mask" onClick=${props.onClose}>
        <div class="sheet sheet-tall" onClick=${function (e) { e.stopPropagation(); }}>
          <div class="sheet-title">快速添加物品（完整字段）</div>
          <div class="form-scroll">
            <div class="form-section">
              <label class="lbl">所属区域 *</label>
              <select class="inp" value=${form.moduleId} onChange=${function (e) { set({ moduleId: e.target.value, categoryId: '' }); }}>
                ${s.modules.map(function (m) { return html`<option key=${m.id} value=${m.id}>${m.name}</option>`; })}
              </select>
            </div>
            <${FullItemFields} form=${form} set=${set} cats=${cats} onPick=${onPick} removeImg=${removeImg} removeVid=${removeVid} showImg=${s.showImg}/>
          </div>
          <div class="sheet-actions">
            <button class="btn-primary" onClick=${save}>保存</button>
            <button class="btn-ghost" onClick=${props.onClose}>取消</button>
          </div>
        </div>
      </div>`;
  }

  function FullItemFields(props) {
    var form = props.form, set = props.set, cats = props.cats;
    return html`
      <div class="form-section">
        <label class="lbl">物品名称 *</label>
        <input class="inp" value=${form.name} onInput=${function (e) { set('name', e.target.value); }} placeholder="例如：A4 纸箱 200个" />
      </div>
      <div class="form-row">
        <div class="form-section">
          <label class="lbl">数量</label>
          <input class="inp" type="number" value=${form.quantity} onInput=${function (e) { set('quantity', e.target.value); }} />
        </div>
        <div class="form-section">
          <label class="lbl">所属分类</label>
          <select class="inp" value=${form.categoryId} onChange=${function (e) { set('categoryId', e.target.value); }}>
            <option value="">（未分类）</option>
            ${cats.map(function (c) { return html`<option key=${c.id} value=${c.id}>${c.name}</option>`; })}
          </select>
        </div>
      </div>
      <div class="form-section">
        <label class="lbl">存放位置</label>
        <input class="inp" value=${form.location} onInput=${function (e) { set('location', e.target.value); }} placeholder="货架 / 区域 / 备注" />
      </div>
      <div class="form-row">
        <div class="form-section">
          <label class="lbl">到货日期</label>
          <input class="inp" type="date" value=${form.arrivalDate} onInput=${function (e) { set('arrivalDate', e.target.value); }} />
        </div>
        <div class="form-section">
          <label class="lbl">到期日期</label>
          <input class="inp" type="date" value=${form.expiryDate} onInput=${function (e) { set('expiryDate', e.target.value); }} />
        </div>
      </div>
      <div class="form-section">
        <label class="lbl">提前提醒天数</label>
        <input class="inp" type="number" value=${form.remindDays} onInput=${function (e) { set('remindDays', e.target.value); }} />
      </div>
      <div class="form-section">
        <label class="lbl">用途 / 备注</label>
        <textarea class="inp" rows="2" value=${form.purposeNote} onInput=${function (e) { set('purposeNote', e.target.value); }}></textarea>
      </div>
      <div class="form-section">
        <label class="lbl">供应商 / 来源</label>
        <input class="inp" value=${form.supplierNote} onInput=${function (e) { set('supplierNote', e.target.value); }} />
      </div>
      <div class="form-section">
        <label class="lbl">图片（${form.images.length}）</label>
        <div class="media-grid">
          ${form.images.map(function (src, i) {
            return html`<div key=${i} class="media-thumb" onClick=${function () { props.showImg(src); }}>
              <img src=${src} />
              <button class="media-del" onClick=${function (e) { e.stopPropagation(); props.removeImg(i); }}>×</button>
            </div>`;
          })}
          <label class="media-add">＋<input type="file" accept="image/*" multiple style=${{ display: 'none' }} onChange=${function (e) { props.onPick(e, 'image'); }} /></label>
        </div>
      </div>
      <div class="form-section">
        <label class="lbl">视频（${form.videos.length}）</label>
        <div class="media-grid">
          ${form.videos.map(function (src, i) {
            return html`<div key=${i} class="media-thumb video">
              <video src=${src} controls></video>
              <button class="media-del" onClick=${function (e) { e.stopPropagation(); props.removeVid(i); }}>×</button>
            </div>`;
          })}
          <label class="media-add">＋<input type="file" accept="video/*" multiple style=${{ display: 'none' }} onChange=${function (e) { props.onPick(e, 'video'); }} /></label>
        </div>
      </div>`;
  }

  function moduleNameOf(modules, id) {
    var m = modules.find(function (x) { return x.id === id; });
    return m ? m.name : '未分类';
  }

  /* ============ 区域页 ============ */
  function ModulePage(props) {
    var s = useStore();
    var _a = useState('all'), cat = _a[0], setCat = _a[1];
    var _b = useState(false), showCat = _b[0], setShowCat = _b[1];
    var _c = useState(''), newCat = _c[0], setNewCat = _c[1];
    var mod = s.modules.find(function (m) { return m.id === props.moduleId; });
    var cats = s.categories.filter(function (c) { return c.moduleId === props.moduleId; });
    var list = s.items.filter(function (it) {
      if (it.moduleId !== props.moduleId) return false;
      if (cat !== 'all' && it.categoryId !== cat) return false;
      return true;
    });
    function doAddCat() {
      var name = newCat.trim();
      if (!name) return;
      addCategory(props.moduleId, name).then(function () { setNewCat(''); s.reload(); s.toast('已添加分类'); });
    }
    function doRename(c) { var n = window.prompt('重命名分类', c.name); if (n && n.trim()) renameCategory(c.id, n).then(s.reload); }
    function doDel(c) { if (window.confirm('删除分类「' + c.name + '」？该分类下的物品不会被删除，仅失去分类。')) deleteCategory(c.id).then(function () { setCat('all'); s.reload(); }); }

    return html`
      <div class="module-page">
        <div class="mp-head">
          <div class="mp-title">${mod ? mod.name : '区域'}</div>
          <button class="btn-ghost" onClick=${function () { setShowCat(true); }}>管理分类</button>
        </div>
        <div class="cat-tabs">
          <button class=${'cat-tab' + (cat === 'all' ? ' active' : '')} onClick=${function () { setCat('all'); }}>全部</button>
          ${cats.map(function (c) {
            return html`<button key=${c.id} class=${'cat-tab' + (cat === c.id ? ' active' : '')} onClick=${function () { setCat(c.id); }}>${c.name}</button>`;
          })}
        </div>
        <div class="item-list">
          ${list.length === 0 ? html`<div class="empty">该分类暂无物品，点右下角 + 添加</div>` :
            list.map(function (it) {
              var st = expiryStatus(it);
              return html`<div key=${it.id} class="item-card" onClick=${function () { navigate('/item/' + it.id); }}>
                <div class="ic-thumb" style=${{ backgroundImage: 'url(' + (it.images && it.images[0] ? it.images[0] : 'default-item.png') + ')' }}></div>
                <div class="ic-body">
                  <div class="ic-name">${it.name}</div>
                  <div class="ic-meta">${it.location ? '📍' + it.location : '未设位置'}${st ? html` · <span class=${'badge ' + st.level}>${st.label}</span>` : ''}</div>
                </div>
                <div class="ic-qty">${it.quantity}</div>
              </div>`;
            })}
        </div>
        <button class="fab" onClick=${function () { navigate('/item/new/' + props.moduleId); }}>＋</button>

        ${showCat ? html`
          <div class="sheet-mask" onClick=${function () { setShowCat(false); }}>
            <div class="sheet" onClick=${function (e) { e.stopPropagation(); }}>
              <div class="sheet-title">分类管理</div>
              <div class="cat-add">
                <input class="inp" placeholder="新分类名称" value=${newCat} onInput=${function (e) { setNewCat(e.target.value); }} />
                <button class="btn-primary" onClick=${doAddCat}>添加</button>
              </div>
              <div class="cat-manage-list">
                ${cats.length === 0 ? html`<div class="empty">暂无分类</div>` :
                  cats.map(function (c) {
                    return html`<div key=${c.id} class="cat-manage-item">
                      <span>${c.name}</span>
                      <span class="row-btns">
                        <button class="btn-mini" onClick=${function () { doRename(c); }}>改名</button>
                        <button class="btn-mini danger" onClick=${function () { doDel(c); }}>删除</button>
                      </span>
                    </div>`;
                  })}
              </div>
              <button class="btn-block" onClick=${function () { setShowCat(false); }}>完成</button>
            </div>
          </div>` : null}
      </div>`;
  }

  /* ============ 物品表单（新增/编辑） ============ */
  function ItemForm(props) {
    var s = useStore();
    var _f = useState(null), form = _f[0], setForm = _f[1];
    var _loaded = useState(false), loaded = _loaded[0], setLoaded = _loaded[1];
    var editId = props.itemId || null;
    useEffect(function () {
      if (editId) {
        getItem(editId).then(function (it) {
          if (it) setForm({
            moduleId: it.moduleId, categoryId: it.categoryId || '', name: it.name, quantity: it.quantity,
            location: it.location, purposeNote: it.purposeNote, supplierNote: it.supplierNote,
            arrivalDate: it.arrivalDate, expiryDate: it.expiryDate, remindDays: it.remindDays,
            images: it.images || [], videos: it.videos || []
          });
          setLoaded(true);
        });
      } else {
        setForm({
          moduleId: props.moduleId, categoryId: '', name: '', quantity: 0, location: '',
          purposeNote: '', supplierNote: '', arrivalDate: '', expiryDate: '', remindDays: 7,
          images: [], videos: []
        });
        setLoaded(true);
      }
    }, []);
    if (!loaded || !form) return html`<div class="loading">加载中…</div>`;

    var cats = s.categories.filter(function (c) { return c.moduleId === form.moduleId; });
    function set(k, v) { setForm(Object.assign({}, form, ((typeof k === 'string') ? (function (o) { o[k] = v; return o; })({}) : k))); }
    function onPick(e, kind) {
      var files = e.target.files; if (!files || !files.length) return;
      Promise.all(Array.prototype.slice.call(files).map(function (f) { return fileToDataUrl(f); })).then(function (urls) {
        if (kind === 'image') set('images', form.images.concat(urls));
        else set('videos', form.videos.concat(urls));
      });
      e.target.value = '';
    }
    function removeImg(i) { var a = form.images.slice(); a.splice(i, 1); set('images', a); }
    function removeVid(i) { var a = form.videos.slice(); a.splice(i, 1); set('videos', a); }
    function save() {
      if (!form.name || !form.name.trim()) { s.toast('请填写物品名称'); return; }
      var q = parseInt(form.quantity, 10); if (isNaN(q)) q = 0;
      var rd = parseInt(form.remindDays, 10); if (isNaN(rd) || rd < 0) rd = 7;
      var data = {
        moduleId: form.moduleId, categoryId: form.categoryId || null, name: form.name.trim(), quantity: q,
        location: form.location, purposeNote: form.purposeNote, supplierNote: form.supplierNote,
        arrivalDate: form.arrivalDate, expiryDate: form.expiryDate, remindDays: rd,
        images: form.images, videos: form.videos
      };
      if (editId) {
        getItem(editId).then(function (it) { Object.assign(it, data); return updateItem(it); }).then(function () { s.reload(); s.toast('已保存'); history.back(); });
      } else {
        createItem(data).then(function () { s.reload(); s.toast('已添加'); history.back(); });
      }
    }
    function remove() {
      if (window.confirm('确认删除该物品？相关的出入库记录也会删除。')) {
        deleteItem(editId).then(function () { s.reload(); s.toast('已删除'); history.back(); });
      }
    }
    return html`
      <div class="form-page">
        <div class="form-section">
          <label class="lbl">所属区域</label>
          <select class="inp" value=${form.moduleId} onChange=${function (e) { set({ moduleId: e.target.value, categoryId: '' }); }}>
            ${s.modules.map(function (m) { return html`<option key=${m.id} value=${m.id}>${m.name}</option>`; })}
          </select>
        </div>
        <${FullItemFields} form=${form} set=${set} cats=${cats} onPick=${onPick} removeImg=${removeImg} removeVid=${removeVid} showImg=${s.showImg}/>
        <div class="form-actions">
          <button class="btn-primary" onClick=${save}>${editId ? '保存修改' : '添加物品'}</button>
          ${editId ? html`<button class="btn-danger" onClick=${remove}>删除物品</button>` : null}
          <button class="btn-ghost" onClick=${function () { history.back(); }}>取消</button>
        </div>
      </div>`;
  }

  /* ============ 物品详情 ============ */
  function ItemDetail(props) {
    var s = useStore();
    var item = s.items.find(function (it) { return it.id === props.itemId; });
    var _idx = useState(0), idx = _idx[0], setIdx = _idx[1];
    if (!item) return html`<div class="empty">物品不存在或已删除</div>`;
    function adj(type) {
      var inp = window.prompt(type === 'in' ? '入库数量（正数）' : '出库数量（正数）', '1');
      if (inp === null) return;
      var q = parseInt(inp, 10); if (isNaN(q) || q <= 0) { s.toast('请输入正数'); return; }
      if (type === 'out' && q > (item.quantity || 0)) {
        if (!window.confirm('出库数量超过当前库存（' + item.quantity + '），仍要出库吗？')) return;
      }
      adjustQuantity(item.id, { type: type, qty: q, note: '' }).then(function () { s.reload(); s.toast(type === 'in' ? '已入库 +' + q : '已出库 -' + q); });
    }
    function setQty() {
      var inp = window.prompt('直接设置当前库存为', String(item.quantity || 0));
      if (inp === null) return;
      var q = parseInt(inp, 10); if (isNaN(q) || q < 0) { s.toast('请输入非负数'); return; }
      adjustQuantity(item.id, { type: 'set', qty: q, note: '手动设置' }).then(function () { s.reload(); s.toast('库存已设为 ' + q); });
    }
    var st = expiryStatus(item);
    var recs = s.records.filter(function (r) { return r.itemId === item.id; });
    var media = (item.images || []).concat((item.videos || []).map(function (v) { return { video: v }; }));

    return html`
      <div class="detail">
        ${media.length ? html`
          <div class="carousel">
            ${media.map(function (m, i) {
              return html`<div key=${i} class=${'slide' + (i === idx ? ' active' : '')}>
                ${m.video ? html`<video src=${m.video} controls></video>` : html`<img src=${m} onClick=${function () { s.showImg(m); }} />`}
              </div>`;
            })}
            ${media.length > 1 ? html`<div class="carousel-nav">
              <button onClick=${function () { setIdx((idx - 1 + media.length) % media.length); }}>‹</button>
              <span>${idx + 1}/${media.length}</span>
              <button onClick=${function () { setIdx((idx + 1) % media.length); }}>›</button>
            </div>` : null}
          </div>` : html`<div class="detail-noimg" onClick=${function () { navigate('/item/edit/' + item.id); }}>📷 暂无图片，点此编辑添加</div>`}

        <div class="detail-card">
          <div class="detail-name">${item.name}</div>
          <div class="detail-qty">库存：<b>${item.quantity}</b></div>
          ${st ? html`<div class=${'badge ' + st.level}>${st.label}（到期 ${fmtDate(item.expiryDate)}）</div>` : null}
          <div class="kv"><span>区域</span><b>${moduleNameOf(s.modules, item.moduleId)}</b></div>
          <div class="kv"><span>分类</span><b>${item.categoryId ? (s.categories.find(function (c) { return c.id === item.categoryId; }) || {}).name || '—' : '未分类'}</b></div>
          <div class="kv"><span>位置</span><b>${item.location || '—'}</b></div>
          <div class="kv"><span>到货</span><b>${fmtDate(item.arrivalDate)}</b></div>
          <div class="kv"><span>到期</span><b>${fmtDate(item.expiryDate)}</b></div>
          <div class="kv"><span>提前提醒</span><b>${item.remindDays} 天</b></div>
          ${item.purposeNote ? html`<div class="kv"><span>备注</span><b>${item.purposeNote}</b></div>` : null}
          ${item.supplierNote ? html`<div class="kv"><span>供应商</span><b>${item.supplierNote}</b></div>` : null}
        </div>

        <div class="detail-actions">
          <button class="btn-primary" onClick=${function () { adj('in'); }}>入库</button>
          <button class="btn-warn" onClick=${function () { adj('out'); }}>出库</button>
          <button class="btn-ghost" onClick=${setQty}>设库存</button>
          <button class="btn-ghost" onClick=${function () { navigate('/item/edit/' + item.id); }}>编辑</button>
        </div>

        <div class="card-title">出入库 / 消耗记录（${recs.length}）</div>
        <div class="rec-list">
          ${recs.length === 0 ? html`<div class="empty">暂无记录</div>` :
            recs.map(function (r) {
              return html`<div key=${r.id} class="rec-item">
                <span class=${'rec-tag ' + r.opType}>${r.opType === 'in' ? '入库' : r.opType === 'out' ? '出库' : '消耗'}</span>
                <span class="rec-qty">${r.opType === 'in' ? '+' : '-'}${r.qty}</span>
                <span class="rec-time">${fmtDate(r.time ? new Date(r.time).toISOString() : '')} ${r.note || ''}</span>
              </div>`;
            })}
        </div>
      </div>`;
  }

  /* ============ 消耗登记 ============ */
  function ConsumptionPage() {
    var s = useStore();
    var _q = useState(''), q = _q[0], setQ = _q[1];
    var _mod = useState(''), modId = _mod[0], setModId = _mod[1];
    var _cat = useState(''), catId = _cat[0], setCatId = _cat[1];
    var _item = useState(''), itemId = _item[0], setItemId = _item[1];
    var _qty = useState('1'), qty = _qty[0], setQty = _qty[1];
    var _note = useState(''), note = _note[0], setNote = _note[1];
    var _mode = useState('search'), mode = _mode[0], setMode = _mode[1];

    var low = q.trim().toLowerCase();
    var matches = useMemo(function () {
      if (!low) return [];
      return s.items.filter(function (it) {
        return [it.name, it.location, it.purposeNote, it.supplierNote].some(function (f) { return (f || '').toLowerCase().indexOf(low) >= 0; });
      }).slice(0, 20);
    }, [q, s.items]);

    var filteredItems = useMemo(function () {
      return s.items.filter(function (it) {
        if (modId && it.moduleId !== modId) return false;
        if (catId && it.categoryId !== catId) return false;
        return true;
      });
    }, [modId, catId, s.items]);

    function selectItem(it) { setItemId(it.id); setQ(it.name); }
    function save() {
      var target = s.items.find(function (it) { return it.id === itemId; });
      if (!target) { s.toast('请先选择物品'); return; }
      var n = parseInt(qty, 10); if (isNaN(n) || n <= 0) { s.toast('请输入有效数量'); return; }
      if (n > (target.quantity || 0)) { s.toast('库存不足，当前 ' + target.quantity); return; }
      consumeItem(target.id, n, note).then(function () {
        s.reload(); s.toast('已登记消耗 -' + n); setQ(''); setItemId(''); setQty('1'); setNote(''); setModId(''); setCatId('');
      }).catch(function (e) { s.toast(e.message); });
    }

    return html`
      <div class="consume-page">
        <div class="card">
          <div class="card-title">每日消耗登记</div>
          <div class="mode-tabs">
            <button class=${'mode-tab' + (mode === 'search' ? ' active' : '')} onClick=${function () { setMode('search'); setItemId(''); }}>关键词搜索</button>
            <button class=${'mode-tab' + (mode === 'select' ? ' active' : '')} onClick=${function () { setMode('select'); setQ(''); setItemId(''); }}>按区域选择</button>
          </div>

          ${mode === 'search' ? html`
            <div class="form-section">
              <label class="lbl">搜索物品（名称 / 位置 / 备注）</label>
              <input class="inp" value=${q} onInput=${function (e) { setQ(e.target.value); setItemId(''); }} placeholder="输入关键词自动匹配" />
            </div>
            ${matches.length ? html`<div class="match-list">
              ${matches.map(function (it) {
                return html`<div key=${it.id} class=${'match-item' + (itemId === it.id ? ' active' : '')} onClick=${function () { selectItem(it); }}>
                  <div class="match-name">${it.name}</div>
                  <div class="match-meta">${moduleNameOf(s.modules, it.moduleId)} · 库存 ${it.quantity}</div>
                </div>`;
              })}
            </div>` : (low ? html`<div class="empty">未找到匹配物品</div>` : null)}
          ` : html`
            <div class="form-row">
              <div class="form-section">
                <label class="lbl">区域</label>
                <select class="inp" value=${modId} onChange=${function (e) { setModId(e.target.value); setCatId(''); setItemId(''); }}>
                  <option value="">选择区域</option>
                  ${s.modules.map(function (m) { return html`<option key=${m.id} value=${m.id}>${m.name}</option>`; })}
                </select>
              </div>
              <div class="form-section">
                <label class="lbl">分类</label>
                <select class="inp" value=${catId} onChange=${function (e) { setCatId(e.target.value); setItemId(''); }}>
                  <option value="">选择分类</option>
                  ${s.categories.filter(function (c) { return !modId || c.moduleId === modId; }).map(function (c) { return html`<option key=${c.id} value=${c.id}>${c.name}</option>`; })}
                </select>
              </div>
            </div>
            <div class="form-section">
              <label class="lbl">物品</label>
              <select class="inp" value=${itemId} onChange=${function (e) { setItemId(e.target.value); }}>
                <option value="">选择物品</option>
                ${filteredItems.map(function (it) { return html`<option key=${it.id} value=${it.id}>${it.name}（库存 ${it.quantity}）</option>`; })}
              </select>
            </div>
          `}

          ${itemId ? html`
            <div class="selected-item">
              <div>已选：${(s.items.find(function (it) { return it.id === itemId; }) || {}).name}</div>
              <div class="selected-stock">当前库存：${(s.items.find(function (it) { return it.id === itemId; }) || {}).quantity}</div>
            </div>
          ` : null}

          <div class="form-row">
            <div class="form-section">
              <label class="lbl">消耗数量</label>
              <input class="inp" type="number" value=${qty} onInput=${function (e) { setQty(e.target.value); }} />
            </div>
            <div class="form-section">
              <label class="lbl">用途备注</label>
              <input class="inp" value=${note} onInput=${function (e) { setNote(e.target.value); }} placeholder="例如：生产部领用" />
            </div>
          </div>
          <div class="form-actions">
            <button class="btn-warn" onClick=${save}>确认消耗</button>
            <button class="btn-ghost" onClick=${function () { setQ(''); setItemId(''); setQty('1'); setNote(''); setModId(''); setCatId(''); }}>重置</button>
          </div>
        </div>
      </div>`;
  }

  /* ============ 记录 / 统计 ============ */
  function Records() {
    var s = useStore();
    var _r = useState('30d'), range = _r[0], setRange = _r[1];
    var _f = useState(''), from = _f[0], setFrom = _f[1];
    var _t = useState(''), to = _t[0], setTo = _t[1];
    var _mod = useState(''), filterMod = _mod[0], setFilterMod = _mod[1];
    var _cat = useState(''), filterCat = _cat[0], setFilterCat = _cat[1];
    var cats = s.categories.filter(function (c) { return !filterMod || c.moduleId === filterMod; });
    function bounds() {
      if (range === 'custom') {
        var f = from ? new Date(from + 'T00:00:00').getTime() : null;
        var t = to ? new Date(to + 'T23:59:59').getTime() : null;
        return { from: f, to: t };
      }
      var now = Date.now(); var map = { today: 0, '7d': 7, '30d': 30, all: null };
      var d = map[range];
      if (d == null) return {};
      var start;
      if (range === 'today') { var t0 = new Date(); t0.setHours(0, 0, 0, 0); start = t0.getTime(); }
      else start = now - d * 86400000;
      return { from: start, to: null };
    }
    var b = bounds();
    var list = s.records.filter(function (r) {
      if (b.from != null && r.time < b.from) return false;
      if (b.to != null && r.time > b.to) return false;
      if (filterMod && r.moduleId !== filterMod) return false;
      if (filterCat && r.categoryId !== filterCat) return false;
      return true;
    });
    var inCount = 0, outCount = 0, consumeCount = 0, inQty = 0, outQty = 0, consumeQty = 0;
    list.forEach(function (r) {
      if (r.opType === 'in') { inCount++; inQty += r.qty; }
      else if (r.opType === 'out') { outCount++; outQty += r.qty; }
      else if (r.opType === 'consume') { consumeCount++; consumeQty += r.qty; }
    });
    var byMod = {};
    s.modules.forEach(function (m) { byMod[m.id] = { name: m.name, in: 0, out: 0, consume: 0 }; });
    list.forEach(function (r) { if (byMod[r.moduleId]) { if (r.opType === 'in') byMod[r.moduleId].in += r.qty; else if (r.opType === 'out') byMod[r.moduleId].out += r.qty; else if (r.opType === 'consume') byMod[r.moduleId].consume += r.qty; } });
    var bars = Object.keys(byMod).map(function (k) { return byMod[k]; }).filter(function (x) { return x.in + x.out + x.consume > 0; });
    var maxV = Math.max(1, Math.max.apply(null, bars.map(function (x) { return Math.max(x.in, x.out, x.consume); })));

    var byCat = {};
    list.filter(function (r) { return r.opType === 'consume'; }).forEach(function (r) {
      var cat = s.categories.find(function (c) { return c.id === r.categoryId; });
      var key = cat ? cat.name : '未分类';
      if (!byCat[key]) byCat[key] = { qty: 0, count: 0 };
      byCat[key].qty += r.qty; byCat[key].count++;
    });

    return html`
      <div class="records-page">
        <div class="range-tabs">
          ${['today', '7d', '30d', 'all', 'custom'].map(function (k) {
            var label = { today: '今天', '7d': '近7天', '30d': '近30天', all: '全部', custom: '自定义' }[k];
            return html`<button key=${k} class=${'range-tab' + (range === k ? ' active' : '')} onClick=${function () { setRange(k); }}>${label}</button>`;
          })}
        </div>
        ${range === 'custom' ? html`<div class="range-custom">
          <input class="inp" type="date" value=${from} onInput=${function (e) { setFrom(e.target.value); }} />
          <span>至</span>
          <input class="inp" type="date" value=${to} onInput=${function (e) { setTo(e.target.value); }} />
        </div>` : null}

        <div class="form-row" style=${{ marginBottom: '10px' }}>
          <div class="form-section">
            <label class="lbl">区域</label>
            <select class="inp" value=${filterMod} onChange=${function (e) { setFilterMod(e.target.value); setFilterCat(''); }}>
              <option value="">全部区域</option>
              ${s.modules.map(function (m) { return html`<option key=${m.id} value=${m.id}>${m.name}</option>`; })}
            </select>
          </div>
          <div class="form-section">
            <label class="lbl">分类</label>
            <select class="inp" value=${filterCat} onChange=${function (e) { setFilterCat(e.target.value); }}>
              <option value="">全部分类</option>
              ${cats.map(function (c) { return html`<option key=${c.id} value=${c.id}>${c.name}</option>`; })}
            </select>
          </div>
        </div>

        <div class="summary">
          <div class="sum"><div class="sum-n in">+${inQty}</div><div class="sum-l">入库（${inCount}次）</div></div>
          <div class="sum"><div class="sum-n out">-${outQty}</div><div class="sum-l">出库（${outCount}次）</div></div>
          <div class="sum"><div class="sum-n consume">-${consumeQty}</div><div class="sum-l">消耗（${consumeCount}次）</div></div>
        </div>

        ${bars.length ? html`
          <div class="card-title">各区域出入库 / 消耗（按量）</div>
          <div class="chart">
            <svg viewBox="0 0 320 ${bars.length * 30 + 10}" width="100%" height=${bars.length * 30 + 10}>
              ${bars.map(function (x, i) {
                var y = i * 30 + 10;
                var wIn = (x.in / maxV) * 90, wOut = (x.out / maxV) * 90, wCon = (x.consume / maxV) * 90;
                return html`
                  <text x="0" y=${y + 6} font-size="11" fill="#5d4e37">${x.name}</text>
                  <rect x="70" y=${y - 6} width=${wIn} height="7" rx="3" fill="#8fcb9b" />
                  <rect x="70" y=${y + 2} width=${wOut} height="7" rx="3" fill="#f4a9a8" />
                  <rect x="70" y=${y + 10} width=${wCon} height="7" rx="3" fill="#f9c784" />
                  <text x="165" y=${y + 6} font-size="10" fill="#9c8c76">+${x.in} / -${x.out} / 耗${x.consume}</text>`;
              })}
            </svg>
          </div>` : null}

        ${consumeQty > 0 ? html`
          <div class="card-title">消耗按分类汇总</div>
          <div class="cat-summary">
            ${Object.keys(byCat).map(function (k) {
              return html`<div key=${k} class="cat-sum-row"><span>${k}</span><b>${byCat[k].qty}（${byCat[k].count}次）</b></div>`;
            })}
          </div>` : null}

        <div class="card-title">明细（${list.length}）</div>
        <div class="rec-list">
          ${list.length === 0 ? html`<div class="empty">该时间范围内暂无记录</div>` :
            list.map(function (r) {
              return html`<div key=${r.id} class="rec-item">
                <span class=${'rec-tag ' + r.opType}>${r.opType === 'in' ? '入库' : r.opType === 'out' ? '出库' : '消耗'}</span>
                <span class="rec-qty">${r.opType === 'in' ? '+' : '-'}${r.qty}</span>
                <span class="rec-time">${moduleNameOf(s.modules, r.moduleId)} · ${r.itemName}<br/>${fmtDate(r.time ? new Date(r.time).toISOString() : '')} ${r.note || ''}</span>
              </div>`;
            })}
        </div>
      </div>`;
  }

  /* ============ 搜索 ============ */
  var SEARCH_HISTORY_KEY = 'lesley_search_history';
  function getSearchHistory() { try { return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]'); } catch (e) { return []; } }
  function saveSearchHistory(list) { localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(list.slice(0, 12))); }
  function addSearchHistory(term) {
    if (!term) return;
    var list = getSearchHistory().filter(function (x) { return x !== term; });
    list.unshift(term);
    saveSearchHistory(list);
  }

  function SearchPage() {
    var s = useStore();
    var _q = useState(''), q = _q[0], setQ = _q[1];
    var _mod = useState(''), filterMod = _mod[0], setFilterMod = _mod[1];
    var _cat = useState(''), filterCat = _cat[0], setFilterCat = _cat[1];
    var _hist = useState(getSearchHistory()), history = _hist[0], setHistory = _hist[1];
    var low = q.trim().toLowerCase();
    var cats = s.categories.filter(function (c) { return !filterMod || c.moduleId === filterMod; });
    var results = s.items.filter(function (it) {
      if (filterMod && it.moduleId !== filterMod) return false;
      if (filterCat && it.categoryId !== filterCat) return false;
      if (!low) return false;
      return [it.name, it.location, it.purposeNote, it.supplierNote].some(function (f) { return (f || '').toLowerCase().indexOf(low) >= 0; });
    });
    function doSearch(term) { setQ(term); addSearchHistory(term); setHistory(getSearchHistory()); }
    function clearHistory() { saveSearchHistory([]); setHistory([]); }
    function removeHistory(term) { var list = history.filter(function (x) { return x !== term }); saveSearchHistory(list); setHistory(list); }
    function hl(text) {
      if (!low || !text) return text;
      var i = (text || '').toLowerCase().indexOf(low);
      if (i < 0) return text;
      return html`${text.slice(0, i)}<mark>${text.slice(i, i + q.length)}</mark>${text.slice(i + q.length)}`;
    }
    return html`
      <div class="search-page">
        <div class="search-box">
          <input class="inp" autoFocus placeholder="搜名称 / 位置 / 备注 / 供应商" value=${q} onInput=${function (e) { setQ(e.target.value); }} onKeyDown=${function (e) { if (e.key === 'Enter') doSearch(q); }} />
        </div>
        <div class="form-row" style=${{ marginTop: '10px' }}>
          <div class="form-section">
            <label class="lbl">区域</label>
            <select class="inp" value=${filterMod} onChange=${function (e) { setFilterMod(e.target.value); setFilterCat(''); }}>
              <option value="">全部区域</option>
              ${s.modules.map(function (m) { return html`<option key=${m.id} value=${m.id}>${m.name}</option>`; })}
            </select>
          </div>
          <div class="form-section">
            <label class="lbl">分类</label>
            <select class="inp" value=${filterCat} onChange=${function (e) { setFilterCat(e.target.value); }}>
              <option value="">全部分类</option>
              ${cats.map(function (c) { return html`<option key=${c.id} value=${c.id}>${c.name}</option>`; })}
            </select>
          </div>
        </div>

        ${history.length && !q ? html`
          <div style=${{ marginTop: '12px' }}>
            <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span class="card-title" style=${{ margin: 0 }}>最近搜索</span>
              <button class="btn-mini" onClick=${clearHistory}>清空</button>
            </div>
            <div class="history-tags">
              ${history.map(function (term) {
                return html`<span key=${term} class="history-tag" onClick=${function () { setQ(term); }}>
                  ${term}<button onClick=${function (e) { e.stopPropagation(); removeHistory(term); }}>×</button>
                </span>`;
              })}
            </div>
          </div>
        ` : null}

        ${q ? html`<div style=${{ marginTop: '10px', fontSize: '13px', color: '#7d6e57' }}>找到 ${results.length} 个结果</div>` : null}
        ${q && !results.length ? html`<div class="empty">没有匹配「${q}」的物品</div>` : null}
        <div class="item-list" style=${{ marginTop: '8px' }}>
          ${results.map(function (it) {
            var st = expiryStatus(it);
            return html`<div key=${it.id} class="item-card" onClick=${function () { navigate('/item/' + it.id); }}>
              <div class="ic-thumb" style=${{ backgroundImage: 'url(' + (it.images && it.images[0] ? it.images[0] : 'default-item.png') + ')' }}></div>
              <div class="ic-body">
                <div class="ic-name">${hl(it.name)}</div>
                <div class="ic-meta">${moduleNameOf(s.modules, it.moduleId)}${it.categoryId ? ' · ' + ((s.categories.find(function (c) { return c.id === it.categoryId; }) || {}).name || '') : ''}${st ? html` · <span class=${'badge ' + st.level}>${st.label}</span>` : ''}</div>
              </div>
              <div class="ic-qty">${it.quantity}</div>
            </div>`;
          })}
        </div>
      </div>`;
  }

  /* ============ 备份 ============ */
  function Backup() {
    var s = useStore();
    var _merge = useState(false), merge = _merge[0], setMerge = _merge[1];
    var _fmt = useState('json'), fmt = _fmt[0], setFmt = _fmt[1];
    var _preview = useState(null), preview = _preview[0], setPreview = _preview[1];

    function buildData() {
      return exportAll().then(function (data) {
        if (fmt === 'json') return { text: JSON.stringify(data, null, 2), type: 'application/json', ext: 'json', filename: 'LESLEY公司仓储备份_' + fmtDate(new Date().toISOString()) + '.json' };
        if (fmt === 'csv') return { text: exportCSV(data), type: 'text/csv;charset=utf-8', ext: 'csv', filename: 'LESLEY公司仓储备份_' + fmtDate(new Date().toISOString()) + '.csv' };
        return { text: exportHTML(data), type: 'text/html;charset=utf-8', ext: 'html', filename: 'LESLEY公司仓储备份_' + fmtDate(new Date().toISOString()) + '.html' };
      });
    }
    function doExport() {
      buildData().then(function (d) {
        var blob = new Blob([d.text], { type: d.type });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = d.filename;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
        s.toast('已导出 ' + d.ext.toUpperCase());
      });
    }
    function showPreview() {
      buildData().then(function (d) {
        if (fmt === 'html') { setPreview({ html: d.text }); }
        else if (fmt === 'csv') {
          var rows = d.text.replace(/^\uFEFF/, '').split('\n').slice(0, 30).map(function (line) { return line.split(',').map(function (c) { return c.replace(/^"|"$/g, '').replace(/""/g, '"'); }); });
          setPreview({ csv: rows });
        } else {
          setPreview({ json: JSON.stringify(JSON.parse(d.text), null, 2) });
        }
      });
    }
    function doImport(e) {
      var file = e.target.files && e.target.files[0]; if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(reader.result);
          if (!window.confirm(merge ? '将备份数据合并进当前数据？' : '将用备份覆盖当前全部数据（不可撤销）？')) return;
          importAll(data, { merge: merge }).then(function () { s.reload(); s.toast('导入完成'); });
        } catch (err) { alert('文件解析失败：' + err.message); }
      };
      reader.readAsText(file);
      e.target.value = '';
    }
    return html`
      <div class="backup-page">
        <div class="card">
          <div class="card-title">导出备份</div>
          <p class="hint">选择导出格式，可先预览再下载。</p>
          <div class="fmt-tabs">
            ${['json', 'csv', 'html'].map(function (k) {
              var label = { json: 'JSON', csv: 'CSV', html: 'HTML 预览' }[k];
              return html`<button key=${k} class=${'fmt-tab' + (fmt === k ? ' active' : '')} onClick=${function () { setFmt(k); }}>${label}</button>`;
            })}
          </div>
          <div class="backup-actions">
            <button class="btn-primary" onClick=${showPreview}>👁 预览</button>
            <button class="btn-ghost" onClick=${doExport}>⬇ 下载 ${fmt.toUpperCase()}</button>
          </div>
        </div>
        <div class="card">
          <div class="card-title">导入备份</div>
          <p class="hint">选择一个之前导出的 JSON 文件恢复数据。</p>
          <label class="chk"><input type="checkbox" checked=${merge} onChange=${function (e) { setMerge(e.target.checked); }} /> 合并到现有数据（不勾则覆盖）</label>
          <label class="btn-ghost file-btn">⬆ 选择备份文件导入<input type="file" accept="application/json,.json" style=${{ display: 'none' }} onChange=${doImport} /></label>
        </div>
        <div class="footer-note">${cloudEnabled() ? '✅ 已开启云端同步，数据自动备份到 GitHub 私有仓库。' : '建议到「设置」开启 GitHub 云端同步，换手机 / 清缓存不丢数据。'}</div>

        ${preview ? html`<${PreviewModal} preview=${preview} fmt=${fmt} onClose=${function () { setPreview(null); }}/>` : null}
      </div>`;
  }

  function PreviewModal(props) {
    return html`
      <div class="sheet-mask" style=${{ zIndex: 300 }} onClick=${props.onClose}>
        <div class="sheet sheet-tall preview-sheet" onClick=${function (e) { e.stopPropagation(); }}>
          <div class="sheet-title">备份预览（${props.fmt.toUpperCase()}）</div>
          <div class="preview-body">
            ${props.preview.json ? html`<pre>${props.preview.json}</pre>` : null}
            ${props.preview.csv ? html`<table class="preview-table">
              <tbody>${props.preview.csv.map(function (row, i) { return html`<tr key=${i}>${row.map(function (c, j) { return html`<td key=${j}>${c}</td>`; })}</tr>`; })}</tbody>
            </table>` : null}
            ${props.preview.html ? html`<div class="preview-html" dangerouslySetInnerHTML=${{ __html: props.preview.html }}></div>` : null}
          </div>
          <div class="sheet-actions">
            <button class="btn-primary" onClick=${props.onClose}>关闭预览</button>
          </div>
        </div>
      </div>`;
  }

  /* ============ 设置 ============ */
  function Settings() {
    var s = useStore();
    var _sync = useState(getSyncState()), sync = _sync[0], setSync = _sync[1];
    var _user = useState(ghUser()), user = _user[0], setUser = _user[1];
    var _token = useState(ghToken()), token = _token[0], setToken = _token[1];
    var _repo = useState(ghRepo()), repo = _repo[0], setRepo = _repo[1];
    var _busy = useState(false), busy = _busy[0], setBusy = _busy[1];

    useEffect(function () {
      var fn = function (st) { setSync(Object.assign({}, st)); };
      onSyncState(fn);
      return function () {
        var i = _syncListeners.indexOf(fn);
        if (i >= 0) _syncListeners.splice(i, 1);
      };
    }, []);

    function clearData() {
      if (window.confirm('确定清空全部数据并恢复默认 9 大区域？此操作不可撤销。')) {
        clearAll().then(function () { s.reload(); s.toast('已清空并恢复默认'); });
      }
    }
    function connect() {
      if (!user.trim() || !token.trim()) { s.toast('请填写用户名和 Token'); return; }
      setBusy(true);
      connectCloud(user, token, repo).then(function () {
        setBusy(false); s.toast('云端同步已开启');
      }).catch(function (e) {
        setBusy(false); s.toast(e.message); alert('连接失败：' + e.message);
      });
    }
    function disconnect() {
      if (window.confirm('断开云端同步？本机数据保留，Token 会被清除。')) {
        disconnectCloud(); setSync(Object.assign({}, getSyncState()));
      }
    }
    function fmtLast(ts) {
      if (!ts) return '未同步';
      var d = new Date(ts);
      return d.getMonth() + 1 + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }

    return html`
      <div class="settings-page">
        <div class="card">
          <div class="card-title">关于</div>
          <div class="kv"><span>应用</span><b>LESLEY公司仓储</b></div>
          <div class="kv"><span>版本</span><b>独立版 1.2（PWA + 云端同步）</b></div>
          <div class="kv"><span>存储</span><b>${cloudEnabled() ? '本机 + GitHub 私有仓库' : '本机 IndexedDB'}</b></div>
        </div>

        <div class="card">
          <div class="card-title">☁️ 云端同步（换手机不丢）</div>
          ${cloudEnabled() ? html`
            <div class="hint" style=${{ color: '#15803d' }}>✅ 已连接 GitHub 私有仓库：${ghUser()}/${ghRepo()}</div>
            <div class="kv"><span>状态</span><b>${sync.status === 'syncing' ? '同步中…' : sync.msg || '正常'}</b></div>
            <div class="kv"><span>最近同步</span><b>${fmtLast(sync.lastSync)}</b></div>
            <div class="settings-actions">
              <button class="btn-primary" onClick=${doPush} disabled=${busy}>${busy ? '处理中…' : '立即同步'}</button>
              <button class="btn-warn" onClick=${function () { pullFromCloud(); }} disabled=${busy}>从云端恢复</button>
              <button class="btn-ghost" onClick=${disconnect}>断开同步</button>
            </div>
          ` : html`
            <p class="hint">输入你的 GitHub 用户名和 Personal Access Token（需 repo 权限），数据会自动同步到 <b>私有仓库</b>。换手机后安装此应用并输入同一 Token 即可恢复。</p>
            <div class="sync-steps">
              <div class="sync-step"><b>1</b> 打开 github.com → 登录你的账号</div>
              <div class="sync-step"><b>2</b> 进入 Settings → Developer settings → Personal access tokens → Tokens (classic)</div>
              <div class="sync-step"><b>3</b> 点击 Generate new token (classic)，勾选 <b>repo</b> 权限，生成并复制 Token</div>
              <div class="sync-step"><b>4</b> 把 Token 粘贴到下方，点击「连接并开启云端同步」</div>
            </div>
            <div class="form-section">
              <label class="lbl">GitHub 用户名</label>
              <input class="inp" value=${user} onInput=${function (e) { setUser(e.target.value); }} placeholder="例如：LEZ888" />
            </div>
            <div class="form-section">
              <label class="lbl">Personal Access Token</label>
              <input class="inp" type="password" value=${token} onInput=${function (e) { setToken(e.target.value); }} placeholder="ghp_xxxxxxxx" />
            </div>
            <div class="form-section">
              <label class="lbl">数据仓库名（默认 lesley-data）</label>
              <input class="inp" value=${repo} onInput=${function (e) { setRepo(e.target.value); }} placeholder="lesley-data" />
            </div>
            <div class="settings-actions">
              <button class="btn-primary" onClick=${connect} disabled=${busy}>${busy ? '连接中…' : '连接并开启云端同步'}</button>
            </div>
          `}
          <div class="hint" style=${{ marginTop: 10 }}>Token 只保存在你的手机/浏览器本地，不会上传给任何第三方。为了数据安全，请勿把 Token 截图或发送给他人。</div>
        </div>

        <div class="card">
          <div class="card-title">数据统计</div>
          <div class="kv"><span>区域</span><b>${s.modules.length}</b></div>
          <div class="kv"><span>物品</span><b>${s.items.length}</b></div>
          <div class="kv"><span>记录</span><b>${s.records.length}</b></div>
        </div>
        <div class="card">
          <div class="card-title">危险操作</div>
          <div class="settings-actions">
            <button class="btn-danger" onClick=${clearData}>清空全部数据并恢复默认</button>
          </div>
        </div>
        <div class="footer-note">永久在线版部署到你的 GitHub Pages：lez888.github.io/enzi-pages/lesley/</div>
      </div>`;
  }

  /* ============ 启动 ============ */
  ReactDOM.createRoot(document.getElementById('root')).render(html`<${ErrorBoundary}><${App}/></${ErrorBoundary}>`);
})();
