#!/usr/bin/env bash
set -euo pipefail

# ─── 配置 ────────────────────────────────────────────────
DEPLOY_DIR="/opt/mozi"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE="${DEPLOY_DIR}/.env"
BACKUP_KEEP_DAYS=7

# ─── 颜色输出 ─────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[DEPLOY]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()  { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ─── 前置检查 ─────────────────────────────────────────────
cd "${DEPLOY_DIR}"

if [ ! -f "${ENV_FILE}" ]; then
  err ".env 文件不存在: ${ENV_FILE}"
  err "请先创建 .env 文件，参考 .env.example"
  exit 1
fi

if [ ! -f "${COMPOSE_FILE}" ]; then
  err "docker-compose 文件不存在: ${COMPOSE_FILE}"
  exit 1
fi

source "${ENV_FILE}"

export IMAGE_TAG="${IMAGE_TAG:-latest}"
export GITHUB_REPOSITORY="${GITHUB_REPOSITORY:-}"

log "部署开始 — IMAGE_TAG=${IMAGE_TAG}"
log "仓库: ${GITHUB_REPOSITORY}"

# ─── 登录 GHCR ────────────────────────────────────────────
if [ -n "${GHCR_TOKEN:-}" ]; then
  log "登录 GitHub Container Registry ..."
  echo "${GHCR_TOKEN}" | docker login ghcr.io -u "${GHCR_USER:-github}" --password-stdin
fi

# ─── 拉取最新镜像 ─────────────────────────────────────────
log "拉取最新镜像 ..."
docker compose -f "${COMPOSE_FILE}" pull --ignore-buildable 2>/dev/null || \
  docker compose -f "${COMPOSE_FILE}" pull

# ─── 备份数据库（可选） ───────────────────────────────────
if docker compose -f "${COMPOSE_FILE}" ps postgres 2>/dev/null | grep -q "running"; then
  log "备份 PostgreSQL 数据库 ..."
  BACKUP_DIR="${DEPLOY_DIR}/backups"
  mkdir -p "${BACKUP_DIR}"
  BACKUP_FILE="${BACKUP_DIR}/mozi_$(date +%Y%m%d_%H%M%S).sql.gz"

  docker compose -f "${COMPOSE_FILE}" exec -T postgres \
    pg_dump -U "${MOZI_DB_USER:-mozi}" "${MOZI_DB_NAME:-mozi}" | gzip > "${BACKUP_FILE}" && \
    log "数据库备份完成: ${BACKUP_FILE}" || \
    warn "数据库备份失败，继续部署 ..."

  find "${BACKUP_DIR}" -name "*.sql.gz" -mtime +"${BACKUP_KEEP_DAYS}" -delete 2>/dev/null || true
fi

# ─── 停止旧服务（基础设施保持运行） ──────────────────────
log "滚动更新微服务 ..."

INFRA_SERVICES="postgres redis minio"
APP_SERVICES="auth-service workspace-service agent-service sandbox-worker mcp-service migrate"
GATEWAY_SERVICES="nginx certbot"

docker compose -f "${COMPOSE_FILE}" up -d ${INFRA_SERVICES}

log "等待基础设施就绪 ..."
for i in $(seq 1 30); do
  if docker compose -f "${COMPOSE_FILE}" exec -T postgres pg_isready -U mozi -d mozi > /dev/null 2>&1 && \
     docker compose -f "${COMPOSE_FILE}" exec -T redis redis-cli ping > /dev/null 2>&1; then
    log "基础设施已就绪"
    break
  fi
  if [ "$i" -eq 30 ]; then
    err "基础设施启动超时"
    exit 1
  fi
  sleep 2
done

# ─── 运行数据库迁移 ───────────────────────────────────────
log "运行数据库迁移 ..."
docker compose -f "${COMPOSE_FILE}" run --rm migrate

# ─── 启动/更新应用服务 ────────────────────────────────────
log "启动应用服务 ..."
docker compose -f "${COMPOSE_FILE}" up -d --remove-orphans

# ─── 检查 SSL 证书并启动网关 ──────────────────────────────
SSL_DIR="${DEPLOY_DIR}/deploy/nginx/ssl"
if [ ! -f "${SSL_DIR}/fullchain.pem" ] || [ ! -f "${SSL_DIR}/privkey.pem" ]; then
  warn "未检测到 SSL 证书，Nginx HTTPS 将无法工作"
  warn "请运行以下命令申请证书："
  warn "  certbot certonly --webroot -w /var/www/certbot -d your-domain.com"
  warn "  或将现有证书复制到 ${SSL_DIR}/"
  warn ""
  warn "临时方案：可先生成自签名证书以启动 Nginx"
  warn "  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \\"
  warn "    -keyout ${SSL_DIR}/privkey.pem -out ${SSL_DIR}/fullchain.pem \\"
  warn "    -subj '/CN=localhost'"
fi

# ─── 等待并验证 ───────────────────────────────────────────
log "等待服务启动（最多 60 秒）..."
sleep 10

RETRIES=5
HEALTHY=true
for i in $(seq 1 ${RETRIES}); do
  UNHEALTHY=$(docker compose -f "${COMPOSE_FILE}" ps 2>/dev/null | grep -c "unhealthy\|Exit" || true)
  if [ "${UNHEALTHY}" -eq 0 ]; then
    break
  fi
  if [ "$i" -eq "${RETRIES}" ]; then
    warn "部分容器状态异常"
    HEALTHY=false
  fi
  sleep 10
done

# ─── 清理旧镜像 ───────────────────────────────────────────
log "清理无用 Docker 镜像 ..."
docker image prune -f --filter "until=72h" 2>/dev/null || true

# ─── 输出状态 ─────────────────────────────────────────────
echo ""
log "═══════════════════════════════════════════"
docker compose -f "${COMPOSE_FILE}" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo ""

if [ "${HEALTHY}" = true ]; then
  log "部署完成 ✓"
else
  warn "部署完成，但存在异常容器，请检查日志："
  warn "  docker compose -f ${COMPOSE_FILE} logs --tail=50"
  exit 1
fi
