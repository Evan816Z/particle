/**
 * =========================================
 * js/mouseTouchControl.js
 * PC 鼠标与移动端触屏交互模块
 * 职责：
 * 1. PC 鼠标左键拖拽：360° 自由旋转土星
 * 2. PC 鼠标滚轮：上滚放大、下滚缩小，限制最大/最小缩放阈值
 * 3. 移动端单指滑动：复刻鼠标拖拽旋转逻辑
 * 4. 移动端双指开合：控制土星缩放
 * 5. 所有交互通过 AppState 写入目标旋转/缩放，由 initScene.js 平滑过渡
 * =========================================
 */

(function () {
  "use strict";

  const state = window.AppState;
  const container = document.getElementById("scene-container");

  // 交互状态
  let isDragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

  // 缩放限制
  const MIN_ZOOM = 0.4;
  const MAX_ZOOM = 3.0;

  // =========================================================
  // PC 鼠标交互
  // =========================================================

  /**
   * 鼠标按下：开始拖拽旋转
   */
  function onMouseDown(event) {
    if (event.button !== 0) return; // 仅响应左键
    isDragging = true;
    state.userInteracting = true;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
  }

  /**
   * 鼠标移动：计算差值并更新土星旋转角度
   */
  function onMouseMove(event) {
    if (!isDragging) return;

    const deltaX = event.clientX - lastMouseX;
    const deltaY = event.clientY - lastMouseY;

    // 水平移动控制 Y 轴旋转，垂直移动控制 X 轴旋转
    state.rotation.y += deltaX * 0.005;
    state.rotation.x += deltaY * 0.005;

    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
  }

  /**
   * 鼠标释放/离开：结束拖拽
   */
  function onMouseUp() {
    isDragging = false;
    state.userInteracting = false;
  }

  /**
   * 鼠标滚轮：缩放土星
   */
  function onWheel(event) {
    event.preventDefault();
    // 统一 deltaY 正负方向：向上滚为负值，放大；向下滚为正值，缩小
    const delta = event.deltaY > 0 ? -0.08 : 0.08;
    state.zoom = window.clamp(state.zoom + delta, MIN_ZOOM, MAX_ZOOM);
  }

  container.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("mouseleave", onMouseUp);
  container.addEventListener("wheel", onWheel, { passive: false });

  // =========================================================
  // 移动端触屏交互
  // =========================================================

  // 触摸状态
  let touchMode = "none"; // "single" 单指旋转，"double" 双指缩放
  let lastTouchX = 0;
  let lastTouchY = 0;
  let lastPinchDistance = 0;

  /**
   * 计算两点之间距离，用于双指缩放
   */
  function getDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 触摸开始：区分单指与双指
   */
  function onTouchStart(event) {
    if (event.touches.length === 1) {
      touchMode = "single";
      state.userInteracting = true;
      lastTouchX = event.touches[0].clientX;
      lastTouchY = event.touches[0].clientY;
    } else if (event.touches.length === 2) {
      touchMode = "double";
      lastPinchDistance = getDistance(event.touches[0], event.touches[1]);
    }
  }

  /**
   * 触摸移动：单指旋转或双指缩放
   */
  function onTouchMove(event) {
    event.preventDefault();

    if (touchMode === "single" && event.touches.length === 1) {
      const touch = event.touches[0];
      const deltaX = touch.clientX - lastTouchX;
      const deltaY = touch.clientY - lastTouchY;

      state.rotation.y += deltaX * 0.006;
      state.rotation.x += deltaY * 0.006;

      lastTouchX = touch.clientX;
      lastTouchY = touch.clientY;
    } else if (touchMode === "double" && event.touches.length === 2) {
      const distance = getDistance(event.touches[0], event.touches[1]);
      const scaleDelta = (distance - lastPinchDistance) * 0.004;
      state.zoom = window.clamp(state.zoom + scaleDelta, MIN_ZOOM, MAX_ZOOM);
      lastPinchDistance = distance;
    }
  }

  /**
   * 触摸结束：重置状态
   */
  function onTouchEnd(event) {
    if (event.touches.length === 0) {
      touchMode = "none";
      state.userInteracting = false;
    } else if (event.touches.length === 1) {
      // 从双指变回单指时，切换为单指旋转模式
      touchMode = "single";
      lastTouchX = event.touches[0].clientX;
      lastTouchY = event.touches[0].clientY;
    }
  }

  container.addEventListener("touchstart", onTouchStart, { passive: false });
  container.addEventListener("touchmove", onTouchMove, { passive: false });
  container.addEventListener("touchend", onTouchEnd);
  container.addEventListener("touchcancel", onTouchEnd);
})();
