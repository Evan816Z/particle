/**
 * =========================================
 * js/initScene.js
 * Three.js 场景初始化与土星粒子渲染模块
 * 职责：
 * 1. 创建 Three.js 场景、相机、渲染器
 * 2. 添加环境光与方向光，模拟太阳光照
 * 3. 生成细碎静态星空粒子背景
 * 4. 生成土星球体粒子（浅黄、米棕、浅橙条纹渐变）
 * 5. 生成土星环粒子（淡灰、奶白、浅棕分层）
 * 6. 响应窗口尺寸变化
 * 7. 每帧动画循环：应用旋转、缩放、位移与平滑缓冲
 * 8. 暴露 rebuildSaturn() 接口，供设置面板与性能降级调用
 * =========================================
 */

(function () {
  "use strict";

  // 检查 Three.js 是否已加载
  if (typeof THREE === "undefined") {
    console.error("[initScene] Three.js 未加载，无法初始化场景");
    return;
  }

  // =========================================================
  // 基础场景对象
  // =========================================================
  const container = document.getElementById("scene-container");
  const scene = new THREE.Scene();
  // 深空背景色与 CSS 背景保持一致
  scene.background = new THREE.Color(0x020204);

  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    2000
  );
  // 初始视角：斜上方俯视土星，距离更近，让远处也能看清细节
  camera.position.set(8, 10, 24);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // =========================================================
  // 光照：环境光 + 方向光（模拟太阳从侧上方照射）
  // =========================================================
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xfff4e0, 1.0);
  sunLight.position.set(20, 12, 18);
  scene.add(sunLight);

  // 背面辅助光，让粒子轮廓更柔和
  const rimLight = new THREE.DirectionalLight(0x445588, 0.2);
  rimLight.position.set(-12, -6, -12);
  scene.add(rimLight);

  // =========================================================
  // 土星对象根节点：所有土星相关粒子统一挂载，便于整体变换
  // =========================================================
  const saturnGroup = new THREE.Group();
  scene.add(saturnGroup);

  let saturnPoints = null; // 土星球体粒子
  let ringPoints = null;   // 土星环粒子
  let starPoints = null;   // 星空粒子

  // 土星基础参数
  const SATURN_BASE_RADIUS = 6;
  const RING_INNER_RADIUS = 9;
  const RING_OUTER_RADIUS = 18;

  // =========================================================
  // 颜色工具函数
  // =========================================================

  /**
   * 将十六进制颜色转换为 Three.js Color 对象
   * @param {string} hex - 十六进制颜色字符串，如 "#f4d03f"
   * @returns {THREE.Color}
   */
  function hexColor(hex) {
    return new THREE.Color(hex);
  }

  /**
   * 在两种颜色之间按 t 进行线性插值
   * @param {THREE.Color} c1
   * @param {THREE.Color} c2
   * @param {number} t
   * @returns {THREE.Color}
   */
  function mixColor(c1, c2, t) {
    return c1.clone().lerp(c2, t);
  }

  // =========================================================
  // 粒子纹理：使用 Canvas 生成圆形柔光贴图，避免默认方块粒子
  // =========================================================

  /**
   * 创建圆形粒子贴图
   * @param {number} size - 贴图尺寸
   * @param {string} glowColor - 光晕颜色（可选）
   * @returns {THREE.CanvasTexture}
   */
  function createCircleTexture(size, glowColor) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    const center = size / 2;
    const radius = size / 2 - 2;

    // 径向渐变：中心高亮，向外扩散柔光，让远处粒子也足够醒目
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, radius);
    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(0.25, "rgba(255, 255, 255, 0.9)");
    gradient.addColorStop(0.55, "rgba(255, 255, 255, 0.5)");
    gradient.addColorStop(0.85, "rgba(255, 255, 255, 0.1)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  // 共享圆形贴图，尺寸更大以保留更多光晕细节
  const circleTexture = createCircleTexture(128);

  // =========================================================
  // 星空粒子生成
  // =========================================================
  function createStarField() {
    const count = 8000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    const color1 = new THREE.Color(0xffffff);
    const color2 = new THREE.Color(0xaaccff);
    const color3 = new THREE.Color(0xffeebb);

    for (let i = 0; i < count; i++) {
      // 在球形空间内随机分布，部分星星放近一点确保可见
      const radius = 60 + Math.random() * 300;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);

      // 随机星光颜色
      const r = Math.random();
      let c;
      if (r < 0.65) c = color1;
      else if (r < 0.88) c = color2;
      else c = color3;

      // 随机亮度变化，大部分较亮
      const brightness = 0.75 + Math.random() * 0.45;
      colors[i * 3] = c.r * brightness;
      colors[i * 3 + 1] = c.g * brightness;
      colors[i * 3 + 2] = c.b * brightness;

      // 随机大小，让星星在远处也清晰可见
      sizes[i] = 0.4 + Math.random() * 1.2;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 1.2,
      map: circleTexture,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      alphaTest: 0.01
    });

    starPoints = new THREE.Points(geometry, material);
    scene.add(starPoints);
  }

  // =========================================================
  // 土星球体粒子生成
  // =========================================================
  function createSaturnSphere() {
    // 基础数量，随 density 变化；降低默认值避免 AdditiveBlending 过度叠加发白
    const baseCount = 5000;
    const count = Math.floor(baseCount * window.AppState.density);

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    // 土星条纹配色：使用更高亮度、更高饱和颜色，确保在 AdditiveBlending 与远距离下依然鲜艳
    const paleYellow = hexColor("#fff8dc");
    const yellow = hexColor("#ffe135");
    const tan = hexColor("#e6b87e");
    const orange = hexColor("#ff9f1c");
    const darkTan = hexColor("#b87333");
    const cream = hexColor("#ffffff");

    const goldenRatio = (1 + Math.sqrt(5)) / 2;

    for (let i = 0; i < count; i++) {
      // Fibonacci 球面采样，保证粒子在球面均匀分布
      const t = i / count;
      const theta = 2 * Math.PI * i / goldenRatio;
      const phi = Math.acos(1 - 2 * t);

      const radius = SATURN_BASE_RADIUS * window.AppState.saturnSize * (0.96 + Math.random() * 0.06);
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.cos(phi);
      const z = radius * Math.sin(phi) * Math.sin(theta);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // 根据纬度生成清晰的条纹色带
      const latitude = y / radius;
      // 使用复合正弦波制造多层土星云带
      const bandValue = Math.sin(latitude * 16) * 0.7 + Math.sin(latitude * 28) * 0.3;

      let c;
      if (bandValue > 0.45) {
        c = cream.clone();
      } else if (bandValue > 0.15) {
        c = mixColor(paleYellow, yellow, 0.7);
      } else if (bandValue > -0.15) {
        c = tan.clone();
      } else if (bandValue > -0.45) {
        c = mixColor(orange, darkTan, 0.5);
      } else {
        c = darkTan.clone();
      }

      // 赤道区域明显提亮
      if (Math.abs(latitude) < 0.18) {
        c = mixColor(c, cream, 0.35);
      }

      // 极区略微加深
      if (Math.abs(latitude) > 0.75) {
        c = mixColor(c, darkTan, 0.25);
      }

      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;

      // 粒子尺寸适中，保证远距离亮度；赤道附近略大
      sizes[i] = 0.22 + Math.random() * 0.12 + (Math.abs(latitude) < 0.25 ? 0.04 : 0);
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 0.28,
      map: circleTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
      // 使用 AdditiveBlending 让粒子自发光，提高亮度让远处也清晰
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      alphaTest: 0.05
    });

    saturnPoints = new THREE.Points(geometry, material);
    saturnGroup.add(saturnPoints);
  }

  // =========================================================
  // 土星环粒子生成
  // =========================================================
  function createSaturnRing() {
    const baseCount = 9000;
    const count = Math.floor(baseCount * window.AppState.density);

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    // 星环配色：使用更高亮度，让环带在远处也清晰可辨
    const gray = hexColor("#ffffff");
    const cream = hexColor("#fff8e7");
    const brown = hexColor("#eac096");
    const darkGray = hexColor("#bbbbbb");

    for (let i = 0; i < count; i++) {
      // 在内外半径之间按平方根分布，保证环面密度均匀
      const t = Math.sqrt(Math.random());
      const radius = (RING_INNER_RADIUS + (RING_OUTER_RADIUS - RING_INNER_RADIUS) * t) * window.AppState.saturnSize;
      const theta = Math.random() * Math.PI * 2;

      // 环的厚度：越靠近土星越厚，整体很薄
      const radiusNorm = (radius / window.AppState.saturnSize - RING_INNER_RADIUS) / (RING_OUTER_RADIUS - RING_INNER_RADIUS);
      const thicknessScale = 1 - 0.5 * radiusNorm;
      const thickness = 0.06 * thicknessScale * window.AppState.saturnSize * (0.5 + Math.random());

      const x = radius * Math.cos(theta);
      const z = radius * Math.sin(theta);
      const y = (Math.random() - 0.5) * thickness;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // 根据半径分层着色，让环带颜色区分更明显
      let c;
      if (radiusNorm < 0.2) {
        // 内环偏暗灰、浅棕
        c = mixColor(darkGray, brown, 0.4 + Math.random() * 0.2);
      } else if (radiusNorm < 0.45) {
        // 中环奶白
        c = cream.clone();
      } else if (radiusNorm < 0.75) {
        // 外环淡灰
        c = mixColor(gray, cream, 0.3 + Math.random() * 0.2);
      } else {
        // 最外环浅棕
        c = mixColor(brown, cream, 0.35 + Math.random() * 0.25);
      }

      // 模拟环缝（Cassini Division）：在特定半径区间减少粒子亮度
      const cassiniStart = 0.55;
      const cassiniEnd = 0.65;
      if (radiusNorm > cassiniStart && radiusNorm < cassiniEnd) {
        c = mixColor(c, new THREE.Color(0x1a1a1a), 0.45);
      }

      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;

      // 星环粒子尺寸适中，保证远距离可见
      sizes[i] = 0.14 + Math.random() * 0.1;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 0.22,
      map: circleTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      alphaTest: 0.05
    });

    ringPoints = new THREE.Points(geometry, material);
    // 星环水平展开，无需额外旋转
    saturnGroup.add(ringPoints);
  }

  // =========================================================
  // 场景重建：当 density 或 saturnSize 变化时调用
  // =========================================================
  window.rebuildSaturn = function () {
    if (saturnPoints) {
      saturnGroup.remove(saturnPoints);
      saturnPoints.geometry.dispose();
      saturnPoints.material.dispose();
      saturnPoints = null;
    }
    if (ringPoints) {
      saturnGroup.remove(ringPoints);
      ringPoints.geometry.dispose();
      ringPoints.material.dispose();
      ringPoints = null;
    }
    createSaturnSphere();
    createSaturnRing();
  };

  // =========================================================
  // 窗口尺寸适配
  // =========================================================
  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener("resize", window.debounce(onWindowResize, 150));

  // =========================================================
  // 动画循环
  // =========================================================
  // 当前实际旋转/缩放/位移值，用于平滑插值
  const current = {
    rotX: 0,
    rotY: 0,
    zoom: 1,
    posX: 0,
    posY: 0
  };

  // 自动缓慢自转速度
  const AUTO_ROTATE_SPEED = 0.0006;

  function animate() {
    requestAnimationFrame(animate);

    const state = window.AppState;

    // 性能监控每帧更新
    window.updatePerformanceMonitor();

    // 如果用户没有主动交互，土星缓慢自转
    if (!state.userInteracting) {
      state.rotation.y += AUTO_ROTATE_SPEED;
    }

    // 平滑插值到目标旋转、缩放、位移
    current.rotX = window.lerp(current.rotX, state.rotation.x, 0.08);
    current.rotY = window.lerp(current.rotY, state.rotation.y, 0.08);
    current.zoom = window.lerp(current.zoom, window.clamp(state.zoom, 0.4, 3.0), 0.1);
    current.posX = window.lerp(current.posX, state.position.x, 0.08);
    current.posY = window.lerp(current.posY, state.position.y, 0.08);

    // 应用变换
    saturnGroup.rotation.x = current.rotX;
    saturnGroup.rotation.y = current.rotY;
    saturnGroup.scale.setScalar(current.zoom);
    saturnGroup.position.set(current.posX * 8, current.posY * 5, 0);

    // 星空背景缓慢旋转，增强景深
    if (starPoints) {
      starPoints.rotation.y += 0.00015;
    }

    renderer.render(scene, camera);
  }

  // =========================================================
  // 初始化入口
  // =========================================================
  createStarField();
  createSaturnSphere();
  createSaturnRing();
  animate();
})();
