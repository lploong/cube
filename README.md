# Rubik's Cube Solver

一个 3D 魔方最少步骤复原网站，基于 Kociemba 两阶段算法实现求解。

## 功能

- **3D 魔方渲染** — Three.js 构建，支持鼠标拖拽旋转视角
- **手动上色** — 点击贴纸切换颜色，自由设置魔方状态
- **一键求解** — Kociemba 算法计算最少步骤复原方案
- **复原动画** — 播放/暂停/单步/调速，直观展示复原过程
- **撤销/重做** — 历史栈管理，随时回退操作

## 快速开始

```bash
pnpm install
pnpm dev
```

打开 http://localhost:5000

## 技术栈

Vite 7 + TypeScript + Three.js + Express + Tailwind CSS + rubik-solver
