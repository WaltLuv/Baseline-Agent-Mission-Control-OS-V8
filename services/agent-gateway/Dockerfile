# syntax=docker/dockerfile:1.7

# ─────────────────────────────────────────────────────────────────────
# Baseline Agent Gateway — Docker image
#
# Important: this image does NOT include the CLI agents (claude, codex,
# opencode) — they're licensed tools that the operator installs into
# the host or a sibling sidecar. The gateway expects to find those CLIs
# on PATH inside the container.
#
# For a "batteries included" container the operator should base off this
# image and add their CLI tooling in a child Dockerfile:
#
#   FROM baseline/agent-gateway:0.1.0
#   RUN curl -sSf https://claude.ai/install.sh | sh && ...
#
# This image is the pure Python service.
# ─────────────────────────────────────────────────────────────────────

FROM python:3.12-slim AS build
WORKDIR /app
COPY pyproject.toml ./
COPY src ./src
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir .

FROM python:3.12-slim AS runtime
ARG GATEWAY_UID=1001

RUN apt-get update && apt-get install -y --no-install-recommends \
        git \
        ca-certificates \
        tini \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid ${GATEWAY_UID} gateway \
    && useradd  --system --uid ${GATEWAY_UID} --gid gateway --home-dir /home/gateway --shell /bin/bash --create-home gateway

# Bring over installed dependencies + entrypoints
COPY --from=build /usr/local/lib/python3.12 /usr/local/lib/python3.12
COPY --from=build /usr/local/bin/agent-gateway /usr/local/bin/agent-gateway

# Data dir owned by the non-root user
RUN mkdir -p /var/lib/agent-gateway && chown -R gateway:gateway /var/lib/agent-gateway
ENV GATEWAY_DATA_DIR=/var/lib/agent-gateway

USER gateway
WORKDIR /home/gateway
EXPOSE 8765
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["agent-gateway", "--host", "0.0.0.0", "--port", "8765"]
