/**
 * =========================================
 * js/settingPanel.js
 * 设置面板控制模块
 * 职责：
 * 1. 控制设置按钮点击弹出/收起侧边面板
 * 2. 绑定粒子密度、土星尺寸滑块事件，实时更新渲染
 * 3. 绑定陀螺仪、摄像头手势识别开关事件
 * 4. 每帧同步 FPS 显示到设置面板
 * 5. 面板自带关闭按钮，一键收回设置界面
 * =========================================
 */

(function () {
  "use strict";

  const state = window.AppState;

  // DOM 元素引用
  const settingsBtn = document.getElementById("settings-btn");
  const settingsPanel = document.getElementById("settings-panel");
  const settingsClose = document.getElementById("settings-close");

  const densitySlider = document.getElementById("density-slider");
  const densityValue = document.getElementById("density-value");
  const sizeSlider = document.getElementById("size-slider");
  const sizeValue = document.getElementById("size-value");

  const gyroToggle = document.getElementById("gyro-toggle");
  const cameraToggle = document.getElementById("camera-toggle");
  const fpsValue = document.getElementById("fps-value");

  // 面板展开/收起状态
  let isPanelOpen = false;

  // =========================================================
  // 面板开关控制
  // =========================================================

  /**
   * 展开设置面板
   */
  function openPanel() {
    isPanelOpen = true;
    settingsPanel.classList.add("open");
    settingsBtn.classList.add("active");
  }

  /**
   * 收起设置面板
   */
  function closePanel() {
    isPanelOpen = false;
    settingsPanel.classList.remove("open");
    settingsBtn.classList.remove("active");
  }

  /**
   * 切换面板状态
   */
  function togglePanel() {
    if (isPanelOpen) {
      closePanel();
    } else {
      openPanel();
    }
  }

  settingsBtn.addEventListener("click", togglePanel);
  settingsClose.addEventListener("click", closePanel);

  // 点击面板外部区域时收起面板
  document.addEventListener("click", function (event) {
    if (
      isPanelOpen &&
      !settingsPanel.contains(event.target) &&
      !settingsBtn.contains(event.target)
    ) {
      closePanel();
    }
  });

  // =========================================================
  // 粒子密度滑块
  // =========================================================

  /**
   * 当密度滑块变化时，更新全局状态并重建土星场景
   */
  function onDensityChange() {
    const value = parseFloat(densitySlider.value);
    state.density = value;
    densityValue.textContent = value.toFixed(1);

    // 用户手动调整密度时，重置自动降级标记
    window.resetPerformanceDowngrade();

    // 重建土星粒子
    if (typeof window.rebuildSaturn === "function") {
      window.rebuildSaturn();
    }
  }

  densitySlider.addEventListener("input", onDensityChange);

  // =========================================================
  // 土星尺寸滑块
  // =========================================================

  /**
   * 当尺寸滑块变化时，更新全局状态并重建土星场景
   */
  function onSizeChange() {
    const value = parseFloat(sizeSlider.value);
    state.saturnSize = value;
    sizeValue.textContent = value.toFixed(1);

    if (typeof window.rebuildSaturn === "function") {
      window.rebuildSaturn();
    }
  }

  sizeSlider.addEventListener("input", onSizeChange);

  // =========================================================
  // 陀螺仪开关
  // =========================================================

  /**
   * 当陀螺仪开关变化时，启用或禁用陀螺仪控制
   */
  function onGyroToggle() {
    if (gyroToggle.checked) {
      if (typeof window.enableGyro === "function") {
        window.enableGyro();
      }
    } else {
      if (typeof window.disableGyro === "function") {
        window.disableGyro();
      }
    }
  }

  gyroToggle.addEventListener("change", onGyroToggle);

  // =========================================================
  // 摄像头手势识别开关
  // =========================================================

  /**
   * 当摄像头手势开关变化时，启用或禁用摄像头手势识别
   */
  function onCameraToggle() {
    if (cameraToggle.checked) {
      if (typeof window.enableHandGesture === "function") {
        window.enableHandGesture();
      }
    } else {
      if (typeof window.disableHandGesture === "function") {
        window.disableHandGesture();
      }
    }
  }

  cameraToggle.addEventListener("change", onCameraToggle);

  // =========================================================
  // FPS 实时显示
  // =========================================================

  /**
   * 使用 requestAnimationFrame 循环更新 FPS 显示，避免每秒频繁 DOM 操作
   */
  let lastFpsUpdate = 0;
  function updateFpsDisplay(timestamp) {
    if (timestamp - lastFpsUpdate >= 500) {
      if (fpsValue) {
        fpsValue.textContent = state.fps;
      }
      lastFpsUpdate = timestamp;
    }
    requestAnimationFrame(updateFpsDisplay);
  }
  requestAnimationFrame(updateFpsDisplay);

  // =========================================================
  // 初始化状态同步
  // =========================================================

  // 根据初始 AppState 同步 UI 控件
  densitySlider.value = state.density;
  densityValue.textContent = state.density.toFixed(1);
  sizeSlider.value = state.saturnSize;
  sizeValue.textContent = state.saturnSize.toFixed(1);
  gyroToggle.checked = state.gyroEnabled;
  cameraToggle.checked = state.cameraEnabled;
})();
