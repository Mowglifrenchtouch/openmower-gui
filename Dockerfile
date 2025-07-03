# ---------- Stage 1 : Go backend ----------
FROM --platform=$BUILDPLATFORM golang:1.21-alpine AS build-go

WORKDIR /app
COPY . .

# Compilation Go (statically linked)
RUN go build -o openmower-gui -ldflags="-s -w" ./openmower-gui


# ---------- Stage 2 : Web frontend ----------
FROM --platform=$BUILDPLATFORM oven/bun:1.1-alpine AS build-web

WORKDIR /web
COPY ./web .

RUN bun install && bun run build


# ---------- Stage 3 : PlatformIO + OpenOCD + ccache ----------
FROM --platform=$BUILDPLATFORM ubuntu:22.04 AS deps

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    ca-certificates curl python3 python3-pip python3-venv git \
    build-essential unzip wget autoconf automake pkg-config \
    texinfo libtool libftdi-dev libusb-1.0-0-dev ccache \
    && rm -rf /var/lib/apt/lists/*

# RPi GPIO (non-bloquant)
RUN apt-get update && apt-get install -y rpi.gpio-common || true

# --- OpenOCD (avec ccache) ---
ENV CC="ccache gcc"
RUN git clone --depth=1 --recursive https://github.com/raspberrypi/openocd.git && \
    cd openocd && ./bootstrap && ./configure \
        --enable-ftdi --enable-sysfsgpio --enable-bcm2835gpio && \
    make -j$(nproc) && make install && \
    cd .. && rm -rf openocd

# --- PlatformIO ---
RUN curl -fsSL https://raw.githubusercontent.com/platformio/platformio-core-installer/master/get-platformio.py -o get-platformio.py && \
    python3 get-platformio.py && \
    python3 -m pip install --no-cache-dir --upgrade pygnssutils && \
    ln -s ~/.platformio/penv/bin/platformio /usr/local/bin/platformio && \
    ln -s ~/.platformio/penv/bin/pio /usr/local/bin/pio && \
    ln -s ~/.platformio/penv/bin/piodebuggdb /usr/local/bin/piodebuggdb && \
    rm get-platformio.py


# ---------- Stage 4 : Final image ----------
FROM ubuntu:22.04

ENV WEB_DIR=/app/web
ENV DB_PATH=/app/db
WORKDIR /app

# Dépendances runtime
RUN apt-get update && apt-get install -y \
    ca-certificates python3 python3-pip libusb-1.0-0 ccache \
    && rm -rf /var/lib/apt/lists/*

# Copie des binaires
COPY --from=deps /usr/local /usr/local
COPY --from=build-web /web/dist ./web
COPY --from=build-go /app/openmower-gui ./openmower-gui
COPY ./setup ./setup

CMD ["./openmower-gui"]
