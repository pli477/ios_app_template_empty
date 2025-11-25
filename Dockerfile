
FROM node:20-alpine AS base
WORKDIR /usr/src/app
COPY package*.json ./
# 安装依赖 跳过 devDependencies
RUN npm ci --omit=dev
COPY . .

# 设置环境变量（可被 Azure 覆盖）
ENV NODE_ENV=production
ENV PORT=3002

# 暴露端口给外部（Azure Container Apps 的 targetPort 就用这个）
EXPOSE 3002

# 启动应用
CMD ["node", "server/server.js"]
