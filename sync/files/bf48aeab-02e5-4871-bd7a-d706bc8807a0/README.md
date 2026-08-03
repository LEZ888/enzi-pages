# LESLEY仓库工作台

移动端仓库库存管理系统（PWA）。支持 Android / iPhone 双平台，**离线可用、数据不丢**。

## 功能概览

- **九大仓库模块**：成品区 / 半成品区 / 包材区 / 盒子区 / 标签区 / 配件区 / 其他区 / 工具区 / 杂物区
- **分类管理**：每个模块内可自建分类（增 / 删 / 改名）
- **物品管理**：名称、数量、位置、用途/供应商备注、到货/到期日期、提前提醒天数、图片视频
- **入库 / 出库**：带数量校验，出库超额二次确认；自动生成出入库明细
- **统计汇总**：按天/周/月/年/自定义时间段，柱状趋势图 + 各模块分布
- **搜索**：全局 / 模块内，关键词高亮
- **到期提醒**：主页提醒区 + 卡片黄/红标签 + 详情高亮，按紧急度排序
- **媒体**：拍照/相册选图与视频、图片裁剪+文字水印、轮播、双指缩放全屏
- **数据安全（三重保障）**：本地 IndexedDB + 一键导出/导入 JSON + 云端同步脚手架（可选）
- **沉浸式体验**：PWA 全屏、状态栏适配、深色模式自动

## 技术栈

React 18 · Vite 5 · PWA（vite-plugin-pwa）· IndexedDB（idb）· React Router · Capacitor（Android/iOS 打包）

## 快速开始（开发）

```bash
npm install
npm run dev          # 本地开发，浏览器打开 http://localhost:5173
```

用手机访问同一局域网地址即可真机调试；或浏览器开 DevTools 切到移动视图。

## 构建与部署

```bash
npm run build        # 产物在 dist/，可直接部署到任意静态托管
npm run preview      # 本地预览构建产物
```

详见 **DEPLOY.md**（部署、PWA 添加到桌面、Capacitor 打包 APK/iOS、云端同步配置）。

## 目录结构

```
lesley-warehouse/
├─ index.html
├─ vite.config.js          # Vite + PWA 配置
├─ capacitor.config.ts     # Capacitor（Android/iOS）配置
├─ public/
│  ├─ default-item.png     # 默认占位图（可替换为你提供的图片）
│  └─ icons/               # PWA 图标
└─ src/
   ├─ main.jsx             # 入口 + 路由
   ├─ styles.css           # 全局样式（移动端工业风）
   ├─ db/database.js       # IndexedDB 数据层 + 导出/导入
   ├─ db/seed.js           # 默认 9 模块
   ├─ store/AppContext.jsx # 全局状态
   ├─ utils/date.js        # 日期/到期计算
   ├─ utils/media.js       # 图片裁剪/水印
   ├─ utils/supabaseSync.js# 云端同步脚手架
   └─ components/          # 各页面与组件
```

> 说明：本版已实现「本地存储 + 导出/导入」两项免费零配置保障；「云端同步」为可选第二步，配置方法见 DEPLOY.md。
