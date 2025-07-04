#!/bin/bash

# Nom de l'image
IMAGE="ghcr.io/mowglifrenchtouch/openmower-gui"

# Tags
TAG_LATEST="latest"
TAG_DATE="$(date +%Y%m%d-%H%M)"
TAG_CACHE="buildcache"
TAG_BUN="bun"

# Répertoire local de cache buildx
CACHE_DIR=".buildx-cache"

# Activer buildx si pas actif
docker buildx inspect builder-openmower > /dev/null 2>&1 || \
  docker buildx create --name builder-openmower --use

# Nettoyage ancien cache local si trop gros (optionnel)
# du -sh $CACHE_DIR

echo "==> Build & push multi-arch avec ccache et buildx..."

docker buildx build \
  --builder builder-openmower \
  --platform linux/amd64,linux/arm64 \
  --file Dockerfile \
  --tag ${IMAGE}:${TAG_LATEST} \
  --tag ${IMAGE}:${TAG_DATE} \
  --cache-from=type=local,src=${CACHE_DIR} \
  --cache-to=type=local,dest=${CACHE_DIR},mode=max \
  --push \
  --build-arg BUILDKIT_INLINE_CACHE=1 \
  .

echo "==> Images poussées :"
echo "   ${IMAGE}:${TAG_LATEST}"
echo "   ${IMAGE}:${TAG_DATE}"
echo "   ${IMAGE}:${TAG_BUN}"