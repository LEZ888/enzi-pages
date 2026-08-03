# 部署与更新文档 · LESLEY仓库工作台

本应用是 **PWA（渐进式 Web 应用）**，部署一次即可在 Android / iPhone 上「添加到主屏幕」全屏使用，
每次打开自动加载最新版本（PWA 特性），无需重新安装。

---

## 一、构建产物

```bash
npm install
npm run build        # 生成 dist/ 静态文件
```

`dist/` 内为纯静态资源（HTML/JS/CSS/图片 + PWA 的 manifest 与 service worker），
可部署到任意支持静态托管的平台。

---

## 二、静态托管部署（推荐，最简单）

任选其一，把 `dist/` 全部文件上传即可：

- **GitHub Pages**（免费）：仓库放 `dist/`，开启 Pages；或 `npm i -g gh-pages && npx gh-pages -d dist`
- **Netlify / Vercel / Cloudflare Pages**（免费）：连接仓库，构建命令 `npm run build`，发布目录 `dist`
- **自有服务器 / 对象存储（COS、OSS、S3）**：上传 `dist/` 并配置默认文档为 `index.html`、
  单页应用回退（SPA fallback）到 `index.html`（service worker 已自带 navigateFallback）

部署后访问站点地址，即可在手机浏览器中打开使用。

---

## 三、添加到手机桌面（全屏体验）

1. **Android（Chrome / Edge）**：打开站点 → 右上菜单 →「添加到主屏幕」→ 命名 → 完成。
   之后桌面出现图标，点击即全屏运行，无地址栏。
2. **iPhone（Safari）**：打开站点 → 底部分享 →「添加到主屏幕」→ 完成。
   之后桌面出现图标，点击即全屏运行。

> 首次打开需联网加载；加载后 service worker 缓存壳，之后可离线使用（数据本体存 IndexedDB）。

---

## 四、版本更新机制

- PWA 模式：每次 `npm run build` 并重新部署后，用户下次打开会自动后台更新到最新版。
- 若用 Capacitor 打包为 App（见下），重新 `npm run build && npx cap sync` 并重新打包分发即可。

---

## 五、Capacitor 打包为原生 App

> 适用场景：需要上架应用商店，或希望更强能力（原生摄像头/相册、推送等）。

### 5.1 前置
- Node.js ≥ 18
- **Android**：安装 [Android Studio](https://developer.android.com/studio)（含 Android SDK、SDK Platform 34+）
- **iOS**：需 **macOS + Xcode**（Windows 无法打包 iOS，仅能提供配置与步骤）

### 5.2 添加平台
```bash
npm install
npm run build
npx cap add android      # 生成 android/ 原生工程
npx cap add ios          # 生成 ios/ 原生工程（需 macOS）
```

### 5.3 同步并打开
```bash
npx cap sync             # 把 dist/ 同步进原生工程
npx cap open android     # 用 Android Studio 打开
npx cap open ios         # 用 Xcode 打开（macOS）
```

### 5.4 生成 Android APK / AAB
- Android Studio 内：`Build → Build Bundle(s) / APK(s) → Build APK(s)`
- 产物在 `android/app/build/outputs/apk/debug/app-debug.apk`（调试包，可直接安装）
- 发布请Build `Release` 并用自有签名；上架 Google Play 需 AAB。

### 5.5 iOS 打包说明（无 Mac 时）
iOS 必须在 macOS + Xcode 中 Archive 并签名发布，Windows 无法完成。
步骤：在 macOS 执行 `npx cap open ios` → Xcode 选真机/模拟器 → `Product → Archive` → 按提示签名。
本仓库已配置 `capacitor.config.ts`（appId: `com.lesley.warehouse`，appName: `LESLEY仓库工作台`），
开箱即用，仅需填入你的开发者签名。

> 注：本开发环境为 Windows，未安装 Android SDK / Xcode，故 APK/iOS 包需在你本机按上述步骤生成。
> 应用所有功能代码均已就绪，打包只是把 Web 产物包进原生壳。

---

## 六、云端同步（可选第二步）

本地数据已可离线使用；如需换手机自动恢复，可配置免费云端（Supabase 免费版）。

### 6.1 创建 Supabase 项目
1. 注册 https://supabase.com （免费版足够）
2. 新建 Project，进入 **Table Editor → New Table**：
   - 表名：`lesley_sync`
   - 字段：`id` uuid (主键, default gen_random_uuid())、`device` text、`payload` jsonb、`updated_at` timestamptz
3. 取 **Project URL** 与 **anon public key**（Settings → API）

### 6.2 配置环境变量
项目根目录新建 `.env`：
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_KEY=eyJ...你的anonKey
```

### 6.3 接入
同步逻辑在 `src/utils/supabaseSync.js`（`pushToCloud` / `pullFromCloud`，零依赖）。
在「备份与恢复」页或设置中调用即可：换手机时登录同一 `device` 标识 → `pullFromCloud` 恢复。
（本版已留好接口，未自动启用，以免缺少配置时报错；按需接入即可。）

---

## 七、默认图片替换

`public/default-item.png` 为物品无图时的占位图。把你提供的那张图片覆盖此文件（同名），
重新 `npm run build` 即可生效。

---

## 八、故障排查

- **白屏**：确认部署平台开启了 SPA 回退到 `index.html`；本地预览用 `npm run preview`。
- **数据不在了**：数据存于浏览器/App 的 IndexedDB，清除站点数据或卸载 App 会丢失；
  重要数据请定期「备份与恢复」导出 JSON。
- **相机/相册打不开**：需 https 或 localhost 环境（PWA 安全上下文）；原生 App 内由 Capacitor 提供。
