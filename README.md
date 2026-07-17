# 写实土星 3D 粒子云可视化

基于原生 HTML5 + CSS3 + JavaScript 的 3D 土星粒子云可视化项目，通过 Three.js 将土星本体与土星环完全由彩色离散粒子拼接成型，支持 PC 鼠标、移动端触屏/陀螺仪、摄像头手势识别四种交互方式。

## 项目目录结构

```
particle/
├── index.html              # 页面入口文件，引入 CSS 与 JS 资源
├── css/
│   └── main.css            # 全局样式、星空背景、悬浮按钮、设置面板、响应式
├── js/
│   ├── performanceOpt.js   # 全局状态、性能监控、防抖/节流/平滑缓冲工具
│   ├── initScene.js        # Three.js 初始化、星空、土星本体与星环粒子生成
│   ├── mouseTouchControl.js # PC 鼠标拖拽/滚轮、移动端单指/双指交互
│   ├── gyroControl.js      # 移动端陀螺仪控制
│   ├── handGesture.js      # 摄像头手势识别与映射
│   └── settingPanel.js     # 设置面板逻辑
└── README.md               # 项目说明
```

## 启动运行说明

本项目为纯静态前端页面，无需安装任何构建打包工具。

### 方式一：直接打开

双击 `index.html` 即可在浏览器中预览完整效果。

### 方式二：本地 HTTP 服务器（推荐，用于摄像头/陀螺仪功能）

由于摄像头和陀螺仪功能需要在 HTTPS 或 localhost 环境下运行，建议在本地启动 HTTP 服务器：

```bash
# 使用 Python 3
python -m http.server 8080

# 或使用 Node.js 的 npx serve
npx serve .
```

启动后访问 http://localhost:8080 即可。

## 交互说明

- **PC 鼠标**：左键拖拽旋转，滚轮缩放
- **移动端触屏**：单指拖拽旋转，双指开合缩放
- **陀螺仪**：在设置面板开启后，倾斜设备控制土星转向
- **摄像头手势**：在设置面板开启后，授权摄像头即可通过手掌控制土星
  - 手掌张开：土星放大
  - 握拳/捏合：土星缩小
  - 手掌上下左右移动：控制土星旋转与位置

## 第三方依赖

- [Three.js](https://threejs.org/)（CDN）
- [HandTrack.js](https://github.com/victordibia/handtrack.js/)（CDN）

## 浏览器兼容性

- 推荐 Chrome、Firefox、Safari、Edge 最新版本
- 陀螺仪与摄像头功能需要 HTTPS 或 localhost 环境
- iOS 13+ 需要用户授权陀螺仪权限
