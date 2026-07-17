/**
 * =========================================
 * js/handGesture.js
 * 摄像头手势识别交互模块
 * 职责：
 * 1. 调用用户前置摄像头并申请权限
 * 2. 使用 HandTrack.js 实时检测手掌位置与开合状态
 * 3. 握拳状态：土星持续缩小
 * 4. 手掌张开状态：土星持续放大
 * 5. 手掌在画面中的上下左右移动：映射为土星旋转与画布整体位置
 * 6. 对所有手势输入增加平滑缓冲，消除抖动与生硬跳转
 * =========================================
 */

(function () {
  "use strict";

  const state = window.AppState;
  const video = document.getElementById("gesture-video");

  // HandTrack.js 模型与状态
  let model = null;
  let isVideoPlaying = false;
  let detectionTimer = null;

  // 平滑状态
  let smoothHandX = 0.5;
  let smoothHandY = 0.5;
  let smoothZoom = state.zoom;

  // 缩放限制
  const MIN_ZOOM = 0.4;
  const MAX_ZOOM = 3.0;

  // 模型加载参数：轻量配置，优先速度
  const modelParams = {
    flipHorizontal: true,   // 前置摄像头需要水平镜像
    maxNumBoxes: 1,         // 只检测一只手
    iouThreshold: 0.5,
    scoreThreshold: 0.65    // 置信度阈值
  };

  /**
   * 加载 HandTrack.js 模型
   * @returns {Promise<object>}
   */
  function loadModel() {
    if (typeof handTrack === "undefined") {
      return Promise.reject(new Error("HandTrack.js 未加载"));
    }
    return handTrack.load(modelParams);
  }

  /**
   * 启动摄像头视频流
   * @returns {Promise<void>}
   */
  function startVideo() {
    if (typeof handTrack === "undefined") {
      return Promise.reject(new Error("HandTrack.js 未加载"));
    }
    return handTrack.startVideo(video);
  }

  /**
   * 停止摄像头视频流
   */
  function stopVideo() {
    if (typeof handTrack !== "undefined") {
      handTrack.stopVideo(video);
    }
    isVideoPlaying = false;
  }

  /**
   * 处理单帧手势检测结果
   * @param {Array} predictions HandTrack.js 预测结果
   */
  function handlePredictions(predictions) {
    if (!state.cameraEnabled || predictions.length === 0) {
      // 没有检测到手时，缓慢将位移归零，缩放保持稳定
      smoothHandX = window.lerp(smoothHandX, 0.5, 0.05);
      smoothHandY = window.lerp(smoothHandY, 0.5, 0.05);
      return;
    }

    const hand = predictions[0];
    const bbox = hand.bbox; // [x, y, width, height]
    const label = hand.label; // 'open', 'closed', 'pinch', 'point', 'face'

    // 计算手掌中心归一化坐标（0~1）
    const videoWidth = video.videoWidth || 640;
    const videoHeight = video.videoHeight || 480;
    const centerX = (bbox[0] + bbox[2] / 2) / videoWidth;
    const centerY = (bbox[1] + bbox[3] / 2) / videoHeight;

    // 平滑手掌位置
    smoothHandX = window.smooth(smoothHandX, centerX, 0.12);
    smoothHandY = window.smooth(smoothHandY, centerY, 0.12);

    // 手掌位置映射：画面中心为 (0.5, 0.5)
    // 手掌左移 -> 土星向左旋转；右移 -> 向右旋转
    // 手掌上移 -> 土星向上旋转；下移 -> 向下旋转
    const offsetX = (smoothHandX - 0.5) * 2; // -1 ~ 1
    const offsetY = (smoothHandY - 0.5) * 2; // -1 ~ 1

    // 只有当用户没有主动拖拽时，手势才接管旋转与位置
    if (!state.userInteracting) {
      state.rotation.y = window.lerp(state.rotation.y, offsetX * 1.2, 0.05);
      state.rotation.x = window.lerp(state.rotation.x, -offsetY * 1.0, 0.05);
      state.position.x = window.lerp(state.position.x, offsetX * 0.3, 0.05);
      state.position.y = window.lerp(state.position.y, -offsetY * 0.2, 0.05);
    }

    // 手势缩放：
    // open / point 视为张开 -> 放大
    // closed / pinch 视为握拳 -> 缩小
    let zoomTarget = state.zoom;
    if (label === "open" || label === "point") {
      zoomTarget = window.clamp(state.zoom + 0.015, MIN_ZOOM, MAX_ZOOM);
    } else if (label === "closed" || label === "pinch") {
      zoomTarget = window.clamp(state.zoom - 0.015, MIN_ZOOM, MAX_ZOOM);
    }

    smoothZoom = window.smooth(smoothZoom, zoomTarget, 0.08);
    state.zoom = smoothZoom;
  }

  /**
   * 运行检测循环
   */
  function runDetection() {
    if (!state.cameraEnabled || !isVideoPlaying || !model) {
      return;
    }

    model.detect(video).then(function (predictions) {
      handlePredictions(predictions);
      detectionTimer = requestAnimationFrame(runDetection);
    }).catch(function (error) {
      console.error("[手势识别] 检测失败", error);
      detectionTimer = requestAnimationFrame(runDetection);
    });
  }

  /**
   * 开启摄像头手势识别
   */
  window.enableHandGesture = function () {
    if (state.cameraEnabled) return;
    state.cameraEnabled = true;

    // 先请求摄像头权限并启动视频
    startVideo()
      .then(function (status) {
        if (status) {
          isVideoPlaying = true;
          // 加载模型（若未加载）
          if (!model) {
            return loadModel();
          }
          return model;
        } else {
          throw new Error("无法启动摄像头");
        }
      })
      .then(function (loadedModel) {
        model = loadedModel;
        runDetection();
        console.log("[手势识别] 已启动");
      })
      .catch(function (error) {
        console.error("[手势识别] 启动失败", error);
        state.cameraEnabled = false;
        // 同步设置面板开关状态
        const cameraToggle = document.getElementById("camera-toggle");
        if (cameraToggle) cameraToggle.checked = false;
      });
  };

  /**
   * 关闭摄像头手势识别
   */
  window.disableHandGesture = function () {
    state.cameraEnabled = false;
    if (detectionTimer) {
      cancelAnimationFrame(detectionTimer);
      detectionTimer = null;
    }
    stopVideo();
    console.log("[手势识别] 已关闭");
  };

  // 默认不开启，等待设置面板触发
})();
