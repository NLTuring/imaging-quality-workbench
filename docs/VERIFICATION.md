# 全息解剖台验收记录

## 已执行检查

- `npm run test`：**34/34 通过**，失败 0；包含原有报告规则、证据来源、DICOM 与新增全息单元测试。
- `npm run build`：TypeScript 检查及 Vite 生产构建通过，完整输出为 `dist/`。
- `npm run test:e2e`：**11 项通过**，失败／跳过／不稳定用例均为 0。
- 原生 GPU 与软件渲染均实际打开生产包 `http://127.0.0.1:5174/#hologram`，完成扫描、解剖与全部发现；本次生产审计无 pageerror / 受检查 console.error / HTTP 失败资源。
- `npm audit --omit=dev`：当次生产依赖审计报告 0 个已知漏洞；不等同于完整安全审计，也不包含开发依赖审计。

## 功能覆盖

1. uploaded pixels pass through scan, inspection, exposed discovery and reset
2. opens a separate lab and can return without modifying report storage
3. a visible 3D lesion can be clicked through its transparent organ shell
4. orbit rotation, wheel zoom, right-button pan and reset change the actual camera
5. reset closes audio and releases image URLs and worker resources
6. PNG thumbnail drag and JPEG file drop stay local and preserve report storage
7. invalid files cannot start a scan and valid retry succeeds
8. skip does not discover lesions and cancelled timelines cannot resume stale stages
9. all four organs render, slice, explode and reset without growing GPU allocations
10. WebGL loss shows an honest fallback while local image statistics remain available
11. narrow layout stays within viewport and controls offer 44px targets

## 性能观测条件与结果

- 采样时间：2026-10-08T04:49:35.354Z（UTC）。
- 浏览器：Chrome 154.0.8037.98；原生渲染器：`ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Laptop GPU (0x00002860) Direct3D11 vs_5_0 ps_5_0, D3D11)`。
- 视口 1440×900，Canvas 1058×567，设备 DPR=1。
- 四阶段生成完成后，每秒读取一次 HUD，共 10 个读数；高画质读数范围 **60–60 FPS**。这是取整后的短时稳态读数，不是帧时间百分位、长时压力测试或全设备承诺。
- 实际 DOM 阶段顺序：0 → 1 → 2 → 3 → 4 → 5。Stage 1 到 Stage 4 本次墙钟间隔 **5.465s**，设计默认 5.45s；前置解码不计入。
- 软件渲染器：`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`。采样显示由 balanced 降到 low；完整采样序列为 [15, 15, 15, 23, 60, 59, 59, 59, 59, 60] FPS。降档有预热与采样延迟，不能声称软件高画质也达到 60 FPS。
- 原生审计与软件审计分开运行；不将桌面 GPU 结果推广到手机 GPU。

## 布局检查

下列视口均实测无页面横向溢出，初始观察视角的器官标签位于 Canvas 边界内：

- 1920×1080
- 1366×768
- 1024×768
- 390×844
- 320×740

390×844 触屏模拟另通过功能测试：默认轻量画质、控件可操作、受检查的可用按钮／选择框／滑块触达高度不小于 44px。截图复查确认窄屏标签不再被截断；这不是完整 WCAG 合规审计。

## 清理与隔离

- 重新扫描后：测试创建的 AudioContext 已关闭，活动图像 URL 为 0，活动分析 Worker 为 0，静音恢复。
- 全流程前后原有 `imaging-quality-v1` 及 localStorage 序列化结果保持一致；测试未观察到文件上传型请求。
- GPU 检查预热了常驻扫描仪、DNA 和扫描幕后，再对四类器官依次扫描／切片／展开／重置；不把第一次延迟上传常驻网格造成的冷暖差异误判为泄漏。
- 预热基线：29 个 geometry，1 个 texture。各次重置后的实测计数：

| 器官 | Geometry | Texture |
|---|---:|---:|
| lungs | 29 | 1 |
| heart | 29 | 1 |
| liver | 29 | 1 |
| brain | 29 | 1 |

## 限制

这是带完整交互的程序化演示，不是临床软件。四器官是参数化占位模型；异常、尺寸、置信度及节律不是真实检测结果。没有实现或验证真实 DICOM 体重建、临床模型剖切、手机实机 GPU、Safari / Firefox 或长时稳定性。桌面目录不是 Git 仓库；本次没有提交、推送或改写历史。

## 原始证据

- `artifacts/hologram/unit-results.txt`
- `artifacts/hologram/build-results.txt`
- `artifacts/hologram/e2e-results.json`
- `artifacts/hologram/dependency-audit.json`
- `artifacts/hologram/gpu-allocations.json`
- `artifacts/hologram/audit/native-2026-10-08T04-49-13-058Z/audit.json`
- `artifacts/hologram/audit/software-2026-10-08T04-51-10-298Z/audit.json`
