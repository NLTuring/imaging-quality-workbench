import type { OrganDefinition, OrganType } from '../types';

/** Deliberately stylized educational silhouettes, not patient anatomy. Local Y: 0..2.4. */
export const ORGAN_REGISTRY: Record<OrganType, OrganDefinition> = {
  lungs: {
    name: '肺部', english: 'LUNGS', description: '左右肺叶与气道的参数化组合。转动视角，观察分叶轮廓与内部演示结构。',
    parts: [
      { id: 'lung-left-upper', name: '左肺上叶', position: [-0.48, 1.48, 0], scale: [0.42, 0.68, 0.4], rotation: [0, 0, -0.15], explodeDirection: [-0.65, 0.25, 0.08] },
      { id: 'lung-left-lower', name: '左肺下叶', position: [-0.52, 0.63, 0.01], scale: [0.46, 0.58, 0.42], explodeDirection: [-0.7, -0.2, 0.12] },
      { id: 'lung-right-upper', name: '右肺上叶', position: [0.48, 1.59, 0], scale: [0.44, 0.58, 0.4], rotation: [0, 0, 0.15], explodeDirection: [0.65, 0.32, 0.08] },
      { id: 'lung-right-middle', name: '右肺中叶', position: [0.55, 1.02, 0.03], scale: [0.46, 0.33, 0.39], explodeDirection: [0.85, 0, 0.22] },
      { id: 'lung-right-lower', name: '右肺下叶', position: [0.54, 0.49, 0], scale: [0.49, 0.45, 0.44], explodeDirection: [0.65, -0.24, 0.08] },
    ],
  },
  heart: {
    name: '心脏', english: 'HEART', description: '非对称心体、简化心房与弯曲血管。节律读数为可复现的演示值，不来自影像测量。',
    parts: [
      { id: 'heart-left-ventricle', name: '左心室模型', position: [-0.24, 0.86, 0.04], scale: [0.52, 0.8, 0.44], rotation: [0, 0, -0.25], explodeDirection: [-0.65, -0.15, 0.1] },
      { id: 'heart-right-ventricle', name: '右心室模型', position: [0.31, 0.93, 0.08], scale: [0.49, 0.65, 0.46], rotation: [0, 0, 0.22], explodeDirection: [0.6, -0.1, 0.2] },
      { id: 'heart-left-atrium', name: '左心房模型', position: [-0.34, 1.63, -0.04], scale: [0.4, 0.37, 0.34], explodeDirection: [-0.5, 0.5, -0.12] },
      { id: 'heart-right-atrium', name: '右心房模型', position: [0.35, 1.6, -0.03], scale: [0.39, 0.4, 0.35], explodeDirection: [0.5, 0.45, -0.12] },
    ],
  },
  liver: {
    name: '肝脏', english: 'LIVER', description: '不对称肝叶的低频曲面组合。切片显示内部层次，展开视图保留各分块的空间联系。',
    parts: [
      { id: 'liver-right', name: '右叶模型', position: [0.28, 1.04, 0], scale: [0.79, 0.62, 0.47], rotation: [0, 0, 0.16], explodeDirection: [0.66, 0.08, 0.05] },
      { id: 'liver-left', name: '左叶模型', position: [-0.58, 1.13, 0.03], scale: [0.58, 0.37, 0.35], rotation: [0, 0, -0.13], explodeDirection: [-0.7, 0.12, 0.12] },
      { id: 'liver-caudate', name: '尾状叶模型', position: [-0.06, 0.68, -0.16], scale: [0.32, 0.32, 0.34], explodeDirection: [0, -0.58, -0.3] },
    ],
  },
  brain: {
    name: '大脑', english: 'BRAIN', description: '双半球、沟回式表面与简化小脑。几何扰动受像素特征驱动，并非真实神经影像重建。',
    parts: [
      { id: 'brain-left', name: '左半球模型', position: [-0.41, 1.22, 0], scale: [0.52, 0.85, 0.62], explodeDirection: [-0.7, 0.2, 0] },
      { id: 'brain-right', name: '右半球模型', position: [0.41, 1.22, 0], scale: [0.52, 0.85, 0.62], explodeDirection: [0.7, 0.2, 0] },
      { id: 'brain-cerebellum', name: '小脑模型', position: [0, 0.35, -0.2], scale: [0.54, 0.26, 0.42], explodeDirection: [0, -0.5, -0.38] },
    ],
  },
};
