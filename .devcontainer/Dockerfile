ARG NODE_VERSION=22
FROM mcr.microsoft.com/devcontainers/typescript-node:${NODE_VERSION}-bookworm

# Electron をコンテナ内でヘッドレス実行・テストするためのライブラリ
RUN apt-get update \
    && export DEBIAN_FRONTEND=noninteractive \
    && apt-get install -y --no-install-recommends \
        xvfb \
        libgtk-3-0 \
        libnss3 \
        libasound2 \
        libgbm1 \
        libdrm2 \
        libxss1 \
        libxtst6 \
        libatk-bridge2.0-0 \
        libxkbcommon0 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
