# BaseCapacitorApp (Capacitor 7 + React 18 + TS)

最小可运行 iOS 模板，仅两个页面：语音识别与空白页。用于分享给不同开发者在此基础上继续扩展功能。

## 技术栈
- Vite + React 18 + TypeScript
- Capacitor 7（iOS）

## 快速开始
```bash
# 安装依赖
npm install

# 本地开发（Web）
npm run dev

# 生产构建
npm run build

# 同步并在 Xcode 打开 iOS 工程
npm run ios
```

首次运行 iOS：
1. 构建：`npm run build`
2. 同步：`npx cap sync ios`（脚本已包含在 `npm run ios`）
3. 使用 Xcode 打开并选择 Team，Deployment Target=14.0，运行到模拟器或真机

## 语音识别与AI回复
- 进入 `/speechRecognition` 同意接入麦克风即可进行系统请求
- 显示识别出来的文字和AI回复，以及相应的延迟
- 目前仅支持openAI audio transcriptions和openAI chat model

## 目录
- `src/pages/speechRecognition.tsx`：语音识别
- `src/pages/BlankPage.tsx`：空白页
- `src/App.tsx`：最小路由（`/speechRecognition`、`/blank`）
- `capacitor.config.ts`：Capacitor 配置

## 扩展指南
- 新增：
  - 安装对应插件
  - 在 `ios/App/App/Info.plist` 补充用途文案
  - 在 `speechRecognition.tsx` 增加不同API进行测试
- 新增页面：在 `src/pages` 中创建组件并在 `src/App.tsx` 路由中注册

## 常见问题
- CocoaPods UTF-8 编码错误：
  - 运行 `export LANG=en_US.UTF-8; export LC_ALL=en_US.UTF-8` 后再执行 `npx cap sync ios`
