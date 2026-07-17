/**
 * =========================================
 * js/gyroControl.js
 * 移动端陀螺仪控制模块
 * 职责：
 * 1. 读取设备方向传感器（deviceorientation）数据
 * 2. 将设备上下/左右倾斜映射为土星旋转
 * 3. 支持通过 AppState.gyroEnabled 手动开启/关闭
 * 4. 使用平滑缓冲算法消除抖动
 * =========================================
 */

(function () {
  "use strict";

  const state = window.AppState;

  // 平滑后的目标旋转偏移量
  let smoothBeta = 0;  // 设备前后倾斜（-180 ~ 180）
  let smoothGamma = 0; // 设备左右倾斜（-90 ~ 90）

  // 是否已请求过权限（iOS 13+ 需要显式请求）
  let permissionRequested = false;

  /**
   * 处理设备方向事件
   * @param {DeviceOrientationEvent} event
   */
  function handleOrientation(event) {
    if (!state.gyroEnabled) return;

    // beta：设备前后倾斜角度（绕 X 轴）
    // gamma：设备左右倾斜角度（绕 Y 轴）
    const beta = event.beta || 0;
    const gamma = event.gamma || 0;

    // 使用指数平滑滤波消除抖动
    smoothBeta = window.smooth(smoothBeta, beta, 0.08);
    smoothGamma = window.smooth(smoothGamma, gamma, 0.08);

    // 将角度映射为土星旋转增量
    // 以设备自然持握位置为基准（beta ≈ 0, gamma ≈ 0）
    const targetRotX = smoothBeta * 0.015;
    const targetRotY = smoothGamma * 0.02;

    // 只有当用户没有主动拖拽时，陀螺仪才接管旋转
    if (!state.userInteracting) {
      state.rotation.x = window.lerp(state.rotation.x, targetRotX, 0.06);
      state.rotation.y = window.lerp(state.rotation.y, targetRotY, 0.06);
    }
  }

  /**
   * 请求 iOS 13+ 陀螺仪权限
   */
  function requestGyroPermission() {
    if (permissionRequested) return;

    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      DeviceOrientationEvent.requestPermission()
        .then(function (permissionState) {
          if (permissionState === "granted") {
            window.addEventListener("deviceorientation", handleOrientation);
          } else {
            console.warn("[陀螺仪] 用户拒绝授权");
            state.gyroEnabled = false;
          }
        })
        .catch(function (error) {
          console.error("[陀螺仪] 请求权限失败", error);
        });
    } else {
      // 非 iOS 13+ 设备直接监听
      window.addEventListener("deviceorientation", handleOrientation);
    }

    permissionRequested = true;
  }

  /**
   * 开启陀螺仪监听
   */
  window.enableGyro = function () {
    state.gyroEnabled = true;
    requestGyroPermission();
  };

  /**
   * 关闭陀螺仪监听
   */
  window.disableGyro = function () {
    state.gyroEnabled = false;
  };

  // 默认不开启，等待设置面板触发
})();
