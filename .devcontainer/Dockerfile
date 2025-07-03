FROM node:18

# Install basic tools
RUN apt update && apt install -y less man-db sudo wget

# Install Go
RUN wget https://go.dev/dl/go1.22.4.linux-amd64.tar.gz && \
    rm -rf /usr/local/go && \
    tar -C /usr/local -xzf go1.22.4.linux-amd64.tar.gz && \
    rm -f go1.22.4.linux-amd64.tar.gz

# Ensure default `node` user has sudo access
ARG USERNAME=node
RUN echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME \
    && chmod 0440 /etc/sudoers.d/$USERNAME

# Switch to user `node` to install Bun in /home/node/.bun
USER node
RUN curl -fsSL https://bun.sh/install | bash

# Bun path
ENV BUN_INSTALL=/home/node/.bun
ENV PATH="${BUN_INSTALL}/bin:${PATH}"

# Go path
ENV PATH=$PATH:/usr/local/go/bin

# Restore root to allow devcontainer commands
USER root

# Mark this as a devcontainer
ENV DEVCONTAINER=true
