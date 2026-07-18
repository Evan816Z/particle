/**
 * =========================================
 * js/performanceOpt.js
 * 全局性能优化与公共工具模块
 * 职责：
 * 1. 定义全局状态对象 AppState，供各模块共享
 * 2. 提供防抖（debounce）、节流（throttle）、平滑插值（lerp）等公共函数
 * 3. 实时 FPS 监控与低帧率自动降级
 * 4. 提供粒子数量上限计算，根据设备性能动态调整
 * =========================================
 */

(function () {
  "use strict";

  // 全局应用状态：各模块通过 window.AppState 读取/写入
  window.AppState = {
    density: 1.5,          // 粒子密度倍率（0.2 ~ 2.0），初始值较高让远处也清晰可见
    saturnSize: 1.0,       // 土星整体尺寸倍率（0.5 ~ 2.0）
    gyroEnabled: false,    // 陀螺仪开关
    cameraEnabled: false,  // 摄像头手势开关
    rotation: { x: 0, y: 0 }, // 当前旋转角度（弧度）
    zoom: 1.0,             // 当前缩放倍率
    position: { x: 0, y: 0 }, // 画布整体位移（归一化）
    fps: 60,               // 实时帧率
    isLowPerformance: false, // 是否已触发自动降级
    userInteracting: false  // 用户是否正在主动交互（鼠标/触屏拖拽中）
  };

  /**
   * 线性插值函数：用于平滑过渡，消除抖动与生硬跳转
   * @param {number} current - 当前值
   * @param {number} target - 目标值
   * @param {number} factor - 插值因子（0~1，越大越灵敏）
   * @returns {number} 插值后的中间值
   */
  window.lerp = function (current, target, factor) {
    return current + (target - current) * factor;
  };

  /**
   * 限制数值在指定区间内
   * @param {number} value - 原始值
   * @param {number} min - 最小值
   * @param {number} max - 最大值
   * @returns {number} 限制后的值
   */
  window.clamp = function (value, min, max) {
    return Math.min(Math.max(value, min), max);
  };

  /**
   * 防抖函数：事件停止触发 wait 毫秒后才执行回调
   * @param {Function} fn - 要执行的函数
   * @param {number} wait - 等待毫秒数
   * @returns {Function} 防抖包装函数
   */
  window.debounce = function (fn, wait) {
    let timer = null;
    return function () {
      const context = this;
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(context, args);
      }, wait);
    };
  };

  /**
   * 节流函数：限制函数在指定周期内最多执行一次
   * @param {Function} fn - 要执行的函数
   * @param {number} limit - 时间周期（毫秒）
   * @returns {Function} 节流包装函数
   */
  window.throttle = function (fn, limit) {
    let inThrottle = false;
    return function () {
      const context = this;
      const args = arguments;
      if (!inThrottle) {
        fn.apply(context, args);
        inThrottle = true;
        setTimeout(function () {
          inThrottle = false;
        }, limit);
      }
    };
  };

  /**
   * 指数平滑滤波：对输入流进行低通滤波，消除高频抖动
   * @param {number} current - 当前平滑值
   * @param {number} raw - 新的原始输入
   * @param {number} alpha - 平滑系数（0~1，越小越平滑）
   * @returns {number} 滤波后的值
   */
  window.smooth = function (current, raw, alpha) {
    return current * (1 - alpha) + raw * alpha;
  };

  // FPS 监控内部状态
  const fpsState = {
    frameCount: 0,
    lastTime: performance.now(),
    lowFpsFrames: 0,       // 连续低帧率计数
    downgradeApplied: false // 是否已经自动降配
  };

  /**
   * 根据设备像素比与历史帧率计算当前允许的最大粒子密度倍率
   * @returns {number} 建议的最大 density 值
   */
  window.getRecommendedDensity = function () {
    const dpr = window.devicePixelRatio || 1;
    // 高像素比屏幕渲染代价高，适当降低密度建议上限
    if (dpr >= 3) return 1.2;
    if (dpr >= 2) return 1.5;
    return 2.0;
  };

  /**
   * 根据当前 density 与 saturnSize 估算总粒子数量
   * 用于在控制台或调试面板中观察性能压力
   * @returns {number} 估算粒子总数
   */
  window.estimateParticleCount = function () {
    // 土星本体约 12000 个基础粒子，星环约 20000 个基础粒子
    const baseCount = 32000;
    return Math.floor(baseCount * window.AppState.density * Math.pow(window.AppState.saturnSize, 2));
  };

  /**
   * 每帧调用，更新 FPS 并执行自动降级逻辑
   */
  window.updatePerformanceMonitor = function () {
    const now = performance.now();
    fpsState.frameCount += 1;

    // 每秒计算一次 FPS
    if (now - fpsState.lastTime >= 1000) {
      const fps = Math.round((fpsState.frameCount * 1000) / (now - fpsState.lastTime));
      window.AppState.fps = fps;
      fpsState.frameCount = 0;
      fpsState.lastTime = now;

      // 如果 FPS 连续 3 秒低于 30，则自动降低粒子密度
      if (fps < 30) {
        fpsState.lowFpsFrames += 1;
      } else {
        fpsState.lowFpsFrames = Math.max(0, fpsState.lowFpsFrames - 1);
      }

      if (fpsState.lowFpsFrames >= 3 && !fpsState.downgradeApplied) {
        fpsState.downgradeApplied = true;
        window.AppState.isLowPerformance = true;
        // 将 density 降低到 0.6，保证低配设备流畅
        window.AppState.density = Math.min(window.AppState.density, 0.6);
        console.warn("[性能优化] 检测到帧率过低，已自动降低粒子密度至 0.6");

        // 如果存在重建函数，则触发场景重建
        if (typeof window.rebuildSaturn === "function") {
          window.rebuildSaturn();
        }
        // 同步设置面板滑块
        const densitySlider = document.getElementById("density-slider");
        if (densitySlider) {
          densitySlider.value = window.AppState.density;
          const densityValue = document.getElementById("density-value");
          if (densityValue) densityValue.textContent = window.AppState.density.toFixed(1);
        }
      }
    }
  };

  /**
   * 主动重置降级状态（例如用户手动调低密度后）
   */
  window.resetPerformanceDowngrade = function () {
    fpsState.downgradeApplied = false;
    window.AppState.isLowPerformance = false;
    fpsState.lowFpsFrames = 0;
  };
})();
