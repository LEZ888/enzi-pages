import os, json, base64

base = r"C:\Users\Administrator\WorkBuddy\2026-07-30-15-47-54\lesley-warehouse-standalone"
out_dir = os.path.abspath(os.path.join(base, "..", "lesley-warehouse-standalone-single"))
os.makedirs(out_dir, exist_ok=True)

with open(os.path.join(base, "index.html"), encoding="utf-8") as f:
    html = f.read()

def inline(src_attr, file_path):
    global html
    with open(os.path.join(base, file_path), encoding="utf-8") as f:
        code = f.read()
    code = code.replace("</script>", "<\\/script>")
    tag = '<script src="%s"></script>' % src_attr
    repl = '<script>/* %s */\n%s</script>' % (src_attr, code)
    assert tag in html, "missing tag: " + tag
    html = html.replace(tag, repl)

inline("vendor/react.js", "vendor/react.js")
inline("vendor/react-dom.js", "vendor/react-dom.js")
inline("vendor/htm.umd.js", "vendor/htm.umd.js")
inline("app.js", "app.js")

# Remove SW registration (single file has no sw.js)
sw_block = '''  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function (e) { console.log('SW 注册失败（不影响使用）:', e); });
      });
    }
  </script>'''
html = html.replace(sw_block, '')

# Inline manifest as base64 data URI (no sub-request)
with open(os.path.join(base, "manifest.webmanifest"), encoding="utf-8") as f:
    manifest = f.read()
mjson = json.dumps(json.loads(manifest), ensure_ascii=False).encode("utf-8")
mdata = "data:application/manifest+json;base64," + base64.b64encode(mjson).decode("ascii")
html = html.replace('href="manifest.webmanifest"', 'href="%s"' % mdata)

# Drop apple-touch-icon (would 404; not needed for content display)
html = html.replace('<link rel="apple-touch-icon" href="icon-192.png" />', '')

out_path = os.path.join(out_dir, "index.html")
with open(out_path, "w", encoding="utf-8") as f:
    f.write(html)

print("written:", out_path)
print("size:", os.path.getsize(out_path))
print("still has external script src:", '<script src=' in html)
