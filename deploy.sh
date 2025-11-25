#!/usr/bin/env bash

set -e

#############################################
# 1. 基础变量（请按需修改）
#############################################

RG="tts-rg"
LOC="eastus"
ACR_NAME="ttsgatewayacr123"
IMAGE_NAME="tts-gateway"
IMAGE_TAG="latest"
APP_NAME="tts-gateway"
ENV_NAME="tts-env"

#############################################
# 2. Key（必填）
#############################################

ELEVEN_KEY="sk_xxxxxxxxxxxxx"
AZURE_KEY="AZURE_KEY"
AZURE_REGION="eastus"

if [ "$ELEVEN_KEY" = "sk_xxxxxxxxxxxxx" ]; then
  echo " 请先在 deploy.sh 里填写 ELEVEN_KEY 和 AZURE_KEY"
  exit 1
fi

#############################################
# 3. 创建资源组
#############################################

echo "创建 Resource Group: $RG"
az group create -n $RG -l $LOC

#############################################
# 4. 注册 ACR 资源提供商（一次即可）
#############################################

echo "注册 Microsoft.ContainerRegistry"
az provider register --namespace Microsoft.ContainerRegistry

#############################################
# 5. 创建 ACR
#############################################

echo "创建 ACR: $ACR_NAME"
az acr create -n $ACR_NAME -g $RG --sku Basic

#############################################
# 6. 登录 ACR
#############################################

echo "登录 ACR"
az acr login -n $ACR_NAME

#############################################
# 7. 本地镜像打 tag 并推送到 ACR
#############################################

echo "给本地镜像打 tag"
docker tag ${IMAGE_NAME}:local $ACR_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG

echo "推送镜像到 ACR"
docker push $ACR_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG

#############################################
# 8. 启用 ACR admin account
#############################################

echo "启用 ACR admin"
az acr update -n $ACR_NAME --admin-enabled true

ACR_USER=$(az acr credential show -n $ACR_NAME --query "username" -o tsv)
ACR_PASS=$(az acr credential show -n $ACR_NAME --query "passwords[0].value" -o tsv)

#############################################
# 9. 创建 Container Apps 环境
#############################################

echo "创建 Container Apps 环境: $ENV_NAME"
az containerapp env create \
  --name $ENV_NAME \
  --resource-group $RG \
  --location $LOC

#############################################
# 10. 创建 Container App
#############################################

echo "创建 Container App: $APP_NAME"

az containerapp create \
  --name $APP_NAME \
  --resource-group $RG \
  --environment $ENV_NAME \
  --image $ACR_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG \
  --target-port 3002 \
  --ingress external \
  --min-replicas 0 \
  --max-replicas 2 \
  --registry-server $ACR_NAME.azurecr.io \
  --registry-username $ACR_USER \
  --registry-password $ACR_PASS \
  --secrets eleven-api-key="$ELEVEN_KEY" azure-speech-key="$AZURE_KEY" \
  --env-vars \
      ELEVEN_API_KEY=secretref:eleven-api-key \
      AZURE_SPEECH_KEY=secretref:azure-speech-key \
      AZURE_SPEECH_REGION=$AZURE_REGION \
      AZURE_TTS_OUTPUT_FORMAT=audio-24khz-48kbitrate-mono-mp3 \
      PORT=3002 \
      NODE_ENV=production \
      LOG_LEVEL=debug


#############################################
# 11. 输出最终 URL
#############################################

URL=$(az containerapp show \
  --name $APP_NAME \
  --resource-group $RG \
  --query "properties.configuration.ingress.fqdn" \
  -o tsv)

echo ""
echo "=============================================="
echo "部署完成："
echo "https://$URL"
echo ""
echo "健康检查："
echo "https://$URL/api/health"
echo ""
echo "WebSocket 地址："
echo " wss://$URL/ws/tts?provider=elevenlabs"
echo " wss://$URL/ws/tts?provider=azure"
echo "=============================================="
