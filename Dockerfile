# ---------- Stage 1 : Go backend ----------
FROM --platform=$BUILDPLATFORM golang:1.21-bookworm AS build-go

WORKDIR /app
COPY . .

# Compilation Go (statically linked)
RUN go build -o openmower-gui -ldflags="-s -w"


# ---------- Stage 2 : Web frontend with Bun ----------
FROM --platform=$BUILDPLATFORM debian:bookworm-slim AS build-web

# Install dependencies for Bun
RUN apt-get update && apt-get install -y \
    curl unzip git ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash

# Add Bun to PATH
ENV PATH="/root/.bun/bin:$PATH"

WORKDIR /web
COPY ./web .

# Build frontend
RUN bun install && bun run build


# ---------- Stage 3 : PlatformIO + OpenOCD + ccache ----------
FROM --platform=$BUILDPLATFORM debian:bookworm-slim AS deps

ENV DEBIAN_FRONTEND=noninteractive
ENV CCACHE_DIR=/ccache
ENV CC="ccache gcc"
ENV CXX="ccache g++"

# Install build dependencies
RUN apt-get update && apt-get install -y \
    curl python3 python3-pip python3-venv git \
    build-essential unzip wget autoconf automake pkg-config \
    texinfo libtool libftdi-dev libusb-1.0-0-dev libjim-dev \
    ccache \
    && rm -rf /var/lib/apt/lists/*

# Optional: configure ccache max size
RUN ccache --max-size=1G

# OpenOCD (raspberrypi fork)
RUN git clone --depth=1 --branch rpi-common https://github.com/raspberrypi/openocd.git && \
    cd openocd && ./bootstrap && ./configure \
        --enable-ftdi --enable-sysfsgpio --enable-bcm2835gpio && \
    make -j$(nproc) && make install && cd .. && rm -rf openocd

# PlatformIO
RUN curl -fsSL https://raw.githubusercontent.com/platformio/platformio-core-installer/master/get-platformio.py -o get-platformio.py && \
    python3 get-platformio.py && \
    python3 -m pip install --no-cache-dir --break-system-packages --upgrade pygnssutils && \
    ln -s /root/.platformio/penv/bin/platformio /usr/local/bin/platformio && \
    ln -s /root/.platformio/penv/bin/pio /usr/local/bin/pio && \
    ln -s /root/.platformio/penv/bin/piodebuggdb /usr/local/bin/piodebuggdb && \
    rm get-platformio.py


# ---------- Stage 4 : Final image ----------
FROM debian:bookworm-slim

ENV WEB_DIR=/app/web
ENV DB_PATH=/app/db
WORKDIR /app

# Runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates python3 python3-pip libusb-1.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy built binaries and assets
COPY --from=deps /usr/local /usr/local
COPY --from=build-web /web/dist ./web
COPY --from=build-go /app/openmower-gui ./openmower-gui
COPY ./setup ./setup

CMD ["./openmower-gui"]
