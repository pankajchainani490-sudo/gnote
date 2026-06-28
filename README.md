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

---

## 🌐 自托管同步服务配置与多端同步

GNote 提供了安全高效的自托管多端同步功能。你可以轻松地在自己的云服务器 (VPS) 上部署 GNote 后端，从而在 macOS 桌面端、Android 手机端和 Web 浏览器端之间进行实时的多端双向数据同步。

### 1. 服务器端部署 (VPS)

你可以选择 Docker 部署（推荐）或者 Node.js 源码部署：

#### A. Docker 部署（推荐，一键运行）
项目根目录下已配置好 `docker-compose.yml`，执行单条命令即可：
```bash
docker-compose up -d
```
* 默认服务将运行在 **`3005`** 端口（对外映射），你可以编辑 `docker-compose.yml` 修改外部端口或自定义环境变量 `API_KEY`。

#### B. Node.js 手动运行
1. 进入 `server/` 文件夹并安装依赖：
   ```bash
   cd server
   npm install
   ```
2. 创建并填写你的 `.env` 配置文件：
   ```bash
   cp .env.example .env
   ```
   编辑 `.env`，修改 `API_KEY`（建议使用一串随机的安全密钥，例如 `noteonly4Gcd`）和 `PORT`（默认 `3001`）。
3. 运行服务：
   ```bash
   npm start
   ```

---

### 2. 客户端同步配置 (Mac / Android / Web)

服务启动后，可在任何客户端配置同步参数开始云同步：

1. **打开配置面板**：
   - 点击主界面左侧导航栏下方的 **⚙️ 齿轮图标（开发者模式设置）**。
2. **填写服务端连接信息**：
   - **服务 API 地址**：输入你的 VPS IP 与对外映射端口（例如：`http://124.222.74.8:3005`）。
   - **API 访问密钥 (Key)**：输入你刚刚在服务器 `.env` 或 `docker-compose.yml` 中配置的 `API_KEY`（例如：`noteonly4Gcd`）。
3. **点击「保存并连接」**：
   - 客户端将发起连通性测试。若连接成功，会显示绿色的“连接成功”状态指示，并自动发起第一次全量数据同步。

---

### 3. 主动同步刷新交互说明

* 📱 **Android 移动端**：
  - 在主界面、待办看板、里程碑等滚动页面，**向下拉动屏幕超过 70px**，松手即可触发 **下拉刷新 (Pull to Refresh)**。顶部会弹出毛玻璃同步状态栏，后台自动执行强制数据合并。
* 💻 **macOS 桌面端 / Web 端**：
  - 点击左下角工具栏内的 **🔄 循环同步按钮**。
  - 同步开启时，循环图标会自动进行流畅的**无限旋转微动效 (Micro-animation)**，完成同步后平滑减速静止。同步期间该按钮自动处于禁用状态，防止并发冲突。
