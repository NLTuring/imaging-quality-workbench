# 医学影像质控与结构化报告工作台 · 全息三维解剖实验室

![React](https://img.shields.io/badge/React-19.3-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-7.0-3178C6?logo=typescript&logoColor=white)
![Three.js](https://img.shields.io/badge/3D-React%20Three%20Fiber%20%2B%20Postprocessing-000000?logo=threedotjs&logoColor=white)
![Playwright](https://img.shields.io/badge/Tests-34%20Unit%20%2B%2011%20Playwright%20E2E-2EAD33?logo=playwright&logoColor=white)

融合**基层医学影像质控与结构化报告工作台**及**交互式三维全息解剖实验室（Hologram Lab）**的双模 Web 应用系统。基于 React 19、TypeScript、React Three Fiber (`@react-three/fiber` / `drei` / `postprocessing`)、`dicom-parser` 与 GSAP 构建。

---

## 核心功能模块

### 1. 医学影像质控与结构化报告工作台
- **DICOM 与多格式影像解析**：集成 `dicom-parser`，支持医学影像元数据读取、图像质量评估（体位、伪影、曝光度等质控规则校验）。
- **证据链绑定的结构化报告**：将影像观测征象与结构化诊断条目联动，支持质控评分、证据溯源与本地持久化存储。

### 2. 全息三维解剖实验室 (`/#hologram`)
- **四类程序化三维器官渲染**：内置肺部、心脏、肝脏、大脑四类三维程序化模型与后处理全息着色效果，支持轨道旋转、滚轮缩放、右键平移与视角复位。
- **六阶段扫描与切片解剖交互**：支持拖拽 PNG/JPEG 影像或素材托盘投喂，驱动“扫描 → 切片封口 → 预分块展开 → 异常病灶暴露”六阶段 GSAP 动画与 Web Audio 合成音效。
- **透明器官壳层穿透拾取**：支持透过半透明器官外壁直接进行三维射线点击（Raycasting）标定内部异常节点，实时计算并展示空间位置、尺寸与置信度指标。
- **严格的资源生命周期管理**：切换或重置时自动释放 ObjectURL、Web Worker 与音频上下文，与主工作台报告存储完全隔离。

---

## 快速启动与自动化验证

环境要求：Node.js 22+。

```bash
npm ci
npm run dev -- --port 5173 --strictPort
```

- 访问 `http://127.0.0.1:5173/` 进入**医学影像质控与结构化报告工作台**。
- 访问 `http://127.0.0.1:5173/#hologram`（或点击顶部导航「全息解剖台」）进入**三维全息解剖实验室**。

### 测试与构建

本项目配备完整的单元测试与 Playwright 端到端浏览器回归测试：

```bash
npm run test        # 运行 34 项单元测试（质控规则、DICOM 解析、全息三维逻辑）
npm run typecheck   # TypeScript 严格类型检查
npm run build       # 生产环境打包输出至 dist/
npm run test:e2e    # 运行 11 项 Playwright 端到端测试
```

---

## 目录结构

```text
imaging-quality-workbench/
├── src/
│   ├── features/hologram/   # 全息三维解剖台（Three.js 器官生成、着色器、六阶段状态机与单元测试）
│   └── ...                  # 影像质控规则引擎、DICOM 解析与结构化报告主工作台
├── scripts/                 # 自动化渲染审计脚本 (audit-hologram.mjs)
├── docs/                    # 架构指南 (HOLOGRAM_GUIDE.md) 与验收测试记录 (VERIFICATION.md)
└── playwright.config.ts     # Playwright E2E 测试配置
```
