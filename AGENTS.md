# AGENTS.md

## 项目概览

3D 魔方最少步骤复原网站，基于 Kociemba 两阶段算法实现求解，支持交互式 3D 渲染、手动上色、复原动画演示。

## 技术栈

- **核心**: Vite 7, TypeScript, Express
- **UI**: Tailwind CSS
- **3D**: Three.js (含 OrbitControls)
- **求解**: rubik-solver (Kociemba 两阶段算法)

## 目录结构

```
├── src/
│   ├── cube/
│   │   ├── constants.ts    # 类型定义、颜色常量、标准状态生成
│   │   ├── solver.ts       # Kociemba 求解器封装（基于 rubik-solver）
│   │   ├── renderer.ts     # Three.js 3D 渲染器（魔方建模、贴纸交互、旋转动画）
│   │   ├── state.ts        # 魔方状态管理（撤销/重做历史栈）
│   │   └── animator.ts     # 动画控制器（播放/暂停/单步/速度）
│   ├── main.ts             # 主应用入口（UI 构建、事件绑定、业务编排）
│   ├── index.ts            # 应用启动点
│   └── index.css           # 全局样式（深色主题）
├── index.html              # 入口 HTML
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 构建与测试命令

- **类型检查**: `pnpm ts-check` 或 `npx tsc --noEmit`
- **Lint**: `pnpm lint` 或 `npx eslint src/`
- **开发**: `pnpm dev` (端口 5000, 热更新)
- **构建**: `pnpm build`
- **生产启动**: `pnpm start`

## 编码规范

- 严格 TypeScript，禁止隐式 `any` 和 `as any`
- 函数参数、返回值、事件对象必须有明确类型
- 使用 pnpm 管理依赖，严禁 npm/yarn
- 使用 Tailwind CSS 进行样式开发
- 优先复用已声明的变量、函数和类型

## 关键数据结构

- **CubeState**: 54 个 ColorName 元素的数组，顺序 U(0-8) R(9-17) F(18-26) D(27-35) L(36-44) B(45-53)
- **ColorName**: `'U' | 'R' | 'F' | 'D' | 'L' | 'B'`（对应白黄绿蓝橙红）
- **Move**: 18 种标准魔方记号（U/U'/U2, R/R'/R2, ...）

## 求解器使用

```ts
import { Cube, initKociembaSolver, solveCube, validateCube } from './cube/solver';

// 初始化（预计算移动表和剪枝表）
await initKociembaSolver();

// 从状态字符串创建
const cube = Cube.fromString(state.join(''));

// 求解
const moves = solveCube(state); // 返回 Move[] | null

// 验证
const result = validateCube(state); // { valid: boolean, errors: string[] }
```

## 3D 渲染器要点

- 26 个 cubie（3x3x3 减中心），每个由黑色方块体 + 外露面贴纸组成
- 贴纸索引映射: `globalIndex = faceIndex * 9 + stickerIndex`
- 旋转动画: 创建临时 pivot group，动画结束后回写位置并 snap 到网格
- OrbitControls 支持鼠标拖拽旋转视角

## 常见问题

- **rubik-solver 导入**: 库同时提供 CJS 和 ESM 入口，Vite 自动选择 ESM
- **求解器初始化**: 需要在后台调用 `initKociembaSolver()`，首次约需 1-3 秒
- **上一步功能**: 通过从头重放到目标步骤实现（不存储中间状态）
- **动画状态**: `animationState` 独立于 `cubeState`，跟踪动画期间的实际魔方状态
