# 第一阶段：安装依赖
FROM rust:latest as builder

RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
RUN apt-get install -y nodejs
RUN corepack enable && corepack prepare pnpm@10.9.0 --activate
RUN npm install -g @tauri-apps/cli

WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages ./packages
RUN pnpm install --frozen-lockfile

# 第二阶段：构建应用
FROM builder as build

COPY . .
RUN pnpm run tauri:build

# 第三阶段：输出结果
FROM alpine:latest as output

COPY --from=build /app/src-tauri/target/release/bundle /bundle
