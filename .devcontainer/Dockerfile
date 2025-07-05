# ---------- Base Node ----------
FROM node:18

# ---------- Root setup ----------
# Install essential tools
RUN apt update && apt install -y \
    less man-db sudo wget curl \
    && rm -rf /var/lib/apt/lists/*

# Install Go
RUN wget https://go.dev/dl/go1.22.4.linux-amd64.tar.gz && \
    rm -rf /usr/local/go && \
    tar -C /usr/local -xzf go1.22.4.linux-amd64.tar.gz && \
    rm -f go1.22.4.linux-amd64.tar.gz

# Give sudo to default `node` user
ARG USERNAME=node
RUN echo "$USERNAME ALL=(root) NOPASSWD:ALL" > /etc/sudoers.d/$USERNAME && \
    chmod 0440 /etc/sudoers.d/$USERNAME

# ---------- Switch to node and install Bun ----------
USER node
RUN curl -fsSL https://bun.sh/install | bash

# ---------- Environment paths ----------
ENV BUN_INSTALL=/home/node/.bun
ENV PATH="${BUN_INSTALL}/bin:/usr/local/go/bin:${PATH}"
ENV DEVCONTAINER=true

# ---------- Back to root for devcontainer usage ----------
USER root