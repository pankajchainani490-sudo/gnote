# GNote

GNote 是一个高颜值、极简主义的原生富文本笔记与任务管理工具。支持**多端同步（Mac + Android）**、**自托管后端服务**和 **PWA 离线运行**。

## 🌟 特性

1. **极致简约风格**：纯白设计，摒弃所有多余的 Emoji 和装饰，支持极致窄边框以及折叠收缩列表。
2. **多设备云同步**：独立的后台定时同步服务，基于 Last-Write-Wins (LWW) 机制自动合并离线冲突。
3. **原生富文本笔记**：腾讯文档/WPS 式的原生行内选择性浮动菜单，标题与字体字号任意调整。
4. **笔记任务联动**：直接在笔记中通过复选框创建待办，大盘看板会自动提取并关联更新状态。
5. **自托管部署**：自带极简 Node.js 后端服务，使用纯 JS 的文件数据库存储，免除数据库安装门槛，支持 Docker 一键运行。
6. **全客户端覆盖**：支持浏览器 PWA 离线安装、Electron 编译 macOS App 以及 Capacitor 编译 Android APK。

## 🚀 快速启动

### 1. 本地运行

* **启动后端服务**：
  ```bash
  cd server
  npm install
  cp .env.example .env  # 并填写你的 API_KEY 和 PORT
  npm start
  ```
* **启动前端开发预览**：
  ```bash
  # 返回项目根目录
  npm install
  npm run dev
  ```
  打开浏览器访问 `http://localhost:5173`。

---

## 📦 客户端打包指南

### 1. macOS 桌面端 (Electron)
```bash
# 一键编译出 DMG 安装文件 (输出于 dist_electron/ 目录下)
npm run mac:build
```

### 2. Android 移动端 (Capacitor)
```bash
# 1. 同步最新的前端编译版本至原生容器
npm run android:sync

# 2. 编译 APK 文件 (需要本地配置有 Android SDK 和 Java 运行环境)
npm run android:build
```
或者直接使用 **Android Studio** 打开 `android/` 目录进行构建。
