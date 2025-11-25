#!/bin/bash

set -e

ACR_NAME=ttsgatewayacr123
IMAGE_NAME=tts-gateway
TAG=latest

echo "==== 登录 Azure ===="
az login

echo "==== 登录 ACR ===="
az acr login --name $ACR_NAME

echo "==== 构建镜像 ===="
docker build -t $IMAGE_NAME:local .

echo "==== 标记镜像 ===="
docker tag $IMAGE_NAME:local ${ACR_NAME}.azurecr.io/${IMAGE_NAME}:${TAG}

echo "==== 推送到 ACR ===="
docker push ${ACR_NAME}.azurecr.io/${IMAGE_NAME}:${TAG}

echo "==== 重启 Container App ===="
az containerapp update \
  --name tts-gateway \
  --resource-group tts-rg \
  --image ${ACR_NAME}.azurecr.io/${IMAGE_NAME}:${TAG}

echo "==== 部署完成！ ===="
