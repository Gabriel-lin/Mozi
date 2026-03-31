# Mozi 生产环境部署指南

本文档涵盖将 Mozi 后端微服务（auth、workspace、agent、sandbox、mcp）及基础设施（PostgreSQL、Redis、MinIO、Nginx）部署到自有服务器的完整流程。

---

## 目录

- [架构概览](#架构概览)
- [前置条件](#前置条件)
- [GitHub Secrets 配置](#github-secrets-配置)
- [服务器初始化](#服务器初始化)
- [SSL 证书配置](#ssl-证书配置)
- [部署流程](#部署流程)
- [服务端口与路由](#服务端口与路由)
- [运维操作](#运维操作)
- [故障排查](#故障排查)

---

## 架构概览

```
                        ┌─────────────────────────────────────────────────┐
                        │                  你的服务器                       │
  Internet              │                                                 │
     │                  │  ┌──────────┐                                   │
     │   :80/:443       │  │  Nginx   │──▶ /api/v1/auth/*    → auth:3001 │
     ├─────────────────▶│  │ (反向代理) │──▶ /api/v1/users/*   → ws:3002  │
     │                  │  │  + SSL   │──▶ /api/v1/workspaces/* → ws:3002│
     │                  │  │          │──▶ /api/v1/agents/*  → agent:3003 │
     │                  │  │          │──▶ /api/v1/mcp/*     → mcp:3005  │
     │                  │  └──────────┘                                   │
     │                  │       │                                         │
     │                  │  ┌────┴─────────────────────────────────┐       │
     │                  │  │         Docker Network (mozi-net)    │       │
     │                  │  │                                      │       │
     │                  │  │  ┌──────────┐  ┌───────┐  ┌───────┐ │       │
     │                  │  │  │PostgreSQL│  │ Redis │  │ MinIO │ │       │
     │                  │  │  │ (pgvector)│  │  7    │  │       │ │       │
     │                  │  │  └──────────┘  └───────┘  └───────┘ │       │
     │                  │  │                                      │       │
     │                  │  │  ┌────────────────┐  ┌────────────┐ │       │
     │                  │  │  │ sandbox-worker │  │  certbot   │ │       │
     │                  │  │  │   (Celery)     │  │ (自动续签)  │ │       │
     │                  │  │  └────────────────┘  └────────────┘ │       │
     │                  │  └──────────────────────────────────────┘       │
     │                  └─────────────────────────────────────────────────┘
```

**CI/CD 流程：**

1. 代码推送到 `main` 分支（`server/` 目录变更）
2. GitHub Actions 并行构建 5 个微服务镜像 → 推送到 GHCR
3. SCP 部署文件到服务器 → SSH 执行部署脚本
4. 部署脚本：备份 DB → 拉取镜像 → 迁移 → 滚动更新
5. 健康检查验证所有服务状态

---

## 前置条件

### 服务器要求

| 项目 | 最低要求 | 推荐配置 |
|------|---------|---------|
| CPU | 2 核 | 4 核+ |
| 内存 | 4 GB | 8 GB+ |
| 磁盘 | 40 GB SSD | 100 GB SSD |
| 系统 | Ubuntu 22.04 / Debian 12 | Ubuntu 24.04 LTS |
| Docker | 24.0+ | 最新稳定版 |
| Docker Compose | v2.20+ | 最新稳定版 |

### 端口需求

| 端口 | 用途 | 对外暴露 |
|------|------|---------|
| 80 | HTTP（重定向到 HTTPS） | 是 |
| 443 | HTTPS（Nginx） | 是 |
| 22 | SSH（部署用） | 是（建议限制 IP） |
| 3001-3005 | 微服务（仅绑定 127.0.0.1） | 否 |
| 5432 | PostgreSQL（仅绑定 127.0.0.1） | 否 |
| 6379 | Redis（仅绑定 127.0.0.1） | 否 |
| 9000/9001 | MinIO（仅绑定 127.0.0.1） | 否 |

---

## GitHub Secrets 配置

进入 GitHub 仓库 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**，添加以下 Secrets：

### 必填 Secrets

| Secret 名称 | 说明 | 示例值 |
|-------------|------|--------|
| `DEPLOY_HOST` | 服务器 IP 或域名 | `203.0.113.10` 或 `deploy.example.com` |
| `DEPLOY_USER` | SSH 登录用户名 | `deploy` 或 `root` |
| `DEPLOY_SSH_KEY` | SSH 私钥（完整内容） | 见下方生成方法 |

### 可选 Secrets

| Secret 名称 | 说明 | 默认值 |
|-------------|------|--------|
| `DEPLOY_SSH_PORT` | SSH 端口 | `22` |

### 生成 SSH 密钥对

```bash
# 在本地机器上生成
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/mozi_deploy

# 将公钥添加到服务器
ssh-copy-id -i ~/.ssh/mozi_deploy.pub deploy@your-server-ip

# 将私钥内容复制到 GitHub Secret DEPLOY_SSH_KEY
cat ~/.ssh/mozi_deploy
```

> **安全提示：** 建议在服务器上创建专用的 `deploy` 用户，而非使用 `root`，并将该用户加入 `docker` 组。

---

## 服务器初始化

### 1. 安装 Docker

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | sh

# 将当前用户加入 docker 组（如果非 root）
sudo usermod -aG docker $USER
newgrp docker

# 验证安装
docker --version
docker compose version
```

### 2. 创建部署目录结构

```bash
sudo mkdir -p /opt/mozi/deploy/nginx/ssl
sudo mkdir -p /opt/mozi/backups
sudo chown -R $(whoami):$(whoami) /opt/mozi
```

### 3. 创建专用部署用户（推荐）

```bash
# 创建 deploy 用户
sudo useradd -m -s /bin/bash deploy
sudo usermod -aG docker deploy

# 设置部署目录权限
sudo chown -R deploy:deploy /opt/mozi

# 配置 SSH 密钥登录
sudo mkdir -p /home/deploy/.ssh
sudo cp ~/.ssh/authorized_keys /home/deploy/.ssh/  # 或手动添加公钥
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

### 4. 配置环境变量

```bash
# 复制模板到服务器
cp deploy/.env.example /opt/mozi/.env

# 编辑环境变量 — 务必修改所有密码和密钥
vi /opt/mozi/.env
```

`.env` 文件必须包含的关键配置：

```bash
# Docker 镜像来源
GITHUB_REPOSITORY=Gabriel-lin/Mozi
IMAGE_TAG=latest

# GHCR 登录（私有仓库必须配置）
GHCR_USER=your-github-username
GHCR_TOKEN=ghp_xxxxxxxxxxxx            # GitHub Personal Access Token (read:packages)

# 数据库 — 务必使用强密码
MOZI_DB_USER=mozi
MOZI_DB_PASSWORD=<生成一个随机强密码>
MOZI_DB_NAME=mozi

# JWT 密钥 — 务必使用随机字符串
MOZI_JWT_SECRET=<生成一个 64 字符的随机字符串>

# GitHub OAuth
MOZI_GITHUB_CLIENT_ID=<你的 GitHub OAuth App Client ID>
MOZI_GITHUB_CLIENT_SECRET=<你的 GitHub OAuth App Client Secret>

# CORS — 设为你的前端域名
MOZI_CORS_ORIGINS=["https://your-domain.com"]

# MinIO
MOZI_MINIO_ACCESS_KEY=<MinIO 访问密钥>
MOZI_MINIO_SECRET_KEY=<MinIO 密钥>
```

**生成随机密码/密钥：**

```bash
# 生成数据库密码
openssl rand -base64 32

# 生成 JWT Secret
openssl rand -hex 32
```

### 5. 配置防火墙

```bash
# UFW（Ubuntu）
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# 或 firewalld（CentOS/RHEL）
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

---

## SSL 证书配置

### 方案一：Let's Encrypt 免费证书（推荐）

```bash
cd /opt/mozi

# 1. 先用自签名证书启动 Nginx（让 certbot 的 HTTP 验证能通过）
openssl req -x509 -nodes -days 1 -newkey rsa:2048 \
  -keyout deploy/nginx/ssl/privkey.pem \
  -out deploy/nginx/ssl/fullchain.pem \
  -subj '/CN=localhost'

# 2. 启动 Nginx
docker compose -f docker-compose.prod.yml up -d nginx

# 3. 使用 certbot 申请真实证书
docker compose -f docker-compose.prod.yml run --rm certbot \
  certbot certonly --webroot -w /var/www/certbot \
  -d your-domain.com \
  --agree-tos \
  --email your-email@example.com \
  --non-interactive

# 4. 复制证书到 nginx ssl 目录
cp /opt/mozi/deploy/nginx/ssl/live/your-domain.com/fullchain.pem deploy/nginx/ssl/
cp /opt/mozi/deploy/nginx/ssl/live/your-domain.com/privkey.pem deploy/nginx/ssl/

# 5. 重新加载 Nginx
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

certbot 容器会自动每 12 小时检查证书续期。

### 方案二：自签名证书（测试环境）

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /opt/mozi/deploy/nginx/ssl/privkey.pem \
  -out /opt/mozi/deploy/nginx/ssl/fullchain.pem \
  -subj '/CN=your-domain.com'
```

### 方案三：已有证书

将你的证书文件复制到 `/opt/mozi/deploy/nginx/ssl/`：
- `fullchain.pem` — 完整证书链
- `privkey.pem` — 私钥

---

## 部署流程

### 自动部署（CI/CD）

当 `server/` 目录下的代码推送到 `main` 分支时，GitHub Actions 会自动触发部署流程：

1. **构建阶段** — 并行构建 5 个微服务 Docker 镜像并推送到 GHCR
2. **部署阶段** — SCP 文件到服务器 → SSH 执行部署脚本
3. **验证阶段** — 远程健康检查所有服务

也可以在 GitHub Actions 页面手动触发部署（`workflow_dispatch`）。

### 手动部署

```bash
ssh deploy@your-server

cd /opt/mozi
export IMAGE_TAG=latest
export GITHUB_REPOSITORY=Gabriel-lin/Mozi
./deploy/scripts/deploy.sh
```

### 首次部署

```bash
cd /opt/mozi

# 1. 确保 .env 已正确配置
cat .env

# 2. 确保 SSL 证书已就位
ls deploy/nginx/ssl/

# 3. 拉取镜像并启动所有服务
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# 4. 查看日志确认启动正常
docker compose -f docker-compose.prod.yml logs -f
```

---

## 服务端口与路由

### Nginx 反向代理路由表

| 路由 | 后端服务 | 端口 |
|------|---------|------|
| `/api/v1/auth/*` | auth-service | 3001 |
| `/api/v1/users/*` | workspace-service | 3002 |
| `/api/v1/workspaces/*` | workspace-service | 3002 |
| `/api/v1/agents/*` | agent-service | 3003 |
| `/api/v1/mcp/*` | mcp-service | 3005 |
| `/storage/*` | MinIO | 9000 |

### 内部服务列表

| 服务 | 镜像 | 端口 | 说明 |
|------|------|------|------|
| postgres | pgvector/pgvector:pg16 | 5432 | 数据库（支持向量搜索） |
| redis | redis:7-alpine | 6379 | 缓存 + Celery broker |
| minio | minio/minio:latest | 9000/9001 | 对象存储 |
| auth-service | GHCR 构建 | 3001 | 认证与授权 |
| workspace-service | GHCR 构建 | 3002 | 工作空间与用户管理 |
| agent-service | GHCR 构建 | 3003 | AI Agent 服务 |
| sandbox-worker | GHCR 构建 | — | Celery Worker（无端口） |
| mcp-service | GHCR 构建 | 3005 | MCP 协议服务 |
| nginx | nginx:1.27-alpine | 80/443 | 反向代理 + SSL |
| certbot | certbot/certbot | — | SSL 证书自动续期 |

---

## 运维操作

### 查看服务状态

```bash
cd /opt/mozi
docker compose -f docker-compose.prod.yml ps
```

### 查看日志

```bash
# 所有服务
docker compose -f docker-compose.prod.yml logs -f --tail=100

# 指定服务
docker compose -f docker-compose.prod.yml logs -f auth-service

# Nginx 访问日志
docker compose -f docker-compose.prod.yml exec nginx cat /var/log/nginx/access.log
```

### 重启服务

```bash
# 重启单个服务
docker compose -f docker-compose.prod.yml restart auth-service

# 重启所有应用服务（不影响数据库）
docker compose -f docker-compose.prod.yml restart auth-service workspace-service agent-service sandbox-worker mcp-service

# 重新加载 Nginx 配置（不中断连接）
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

### 数据库操作

```bash
# 进入 psql
docker compose -f docker-compose.prod.yml exec postgres psql -U mozi -d mozi

# 手动备份
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U mozi mozi | gzip > backups/manual_$(date +%Y%m%d).sql.gz

# 恢复备份
gunzip -c backups/mozi_20260331.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres psql -U mozi -d mozi
```

### 手动执行数据库迁移

```bash
docker compose -f docker-compose.prod.yml run --rm migrate
```

### 扩缩容

```bash
# 增加 sandbox worker 数量
docker compose -f docker-compose.prod.yml up -d --scale sandbox-worker=3
```

---

## 故障排查

### 常见问题

**Q: 服务启动失败，提示 "MOZI_DB_PASSWORD is required"**

确保 `/opt/mozi/.env` 文件存在且包含所有必填环境变量。

**Q: Nginx 返回 502 Bad Gateway**

```bash
# 检查后端服务是否正常运行
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs auth-service --tail=50
```

**Q: 数据库连接失败**

```bash
# 检查 PostgreSQL 是否健康
docker compose -f docker-compose.prod.yml exec postgres pg_isready -U mozi
# 检查连接 URL 是否正确
docker compose -f docker-compose.prod.yml exec auth-service env | grep DATABASE
```

**Q: GHCR 镜像拉取失败 (401 Unauthorized)**

确保 `.env` 中配置了正确的 `GHCR_USER` 和 `GHCR_TOKEN`。Token 需要 `read:packages` 权限。

生成 Token：GitHub → Settings → Developer settings → Personal access tokens → 勾选 `read:packages`。

**Q: SSL 证书问题**

```bash
# 检查证书是否存在
ls -la /opt/mozi/deploy/nginx/ssl/
# 检查证书有效期
openssl x509 -in deploy/nginx/ssl/fullchain.pem -noout -dates
# 手动续期
docker compose -f docker-compose.prod.yml run --rm certbot certbot renew
```

### 日志收集

```bash
# 导出所有服务近 1 小时的日志
docker compose -f docker-compose.prod.yml logs --since=1h > /tmp/mozi-logs.txt 2>&1
```

### 完全重置

```bash
cd /opt/mozi

# 停止所有服务
docker compose -f docker-compose.prod.yml down

# 停止并删除数据卷（⚠️ 会丢失所有数据）
docker compose -f docker-compose.prod.yml down -v

# 重新部署
docker compose -f docker-compose.prod.yml up -d
```
