# ---------- Stage 1 : Go backend ----------
<<<<<<< HEAD
FROM --platform=$BUILDPLATFORM golang:1.21-bookworm AS build-go

ARG TARGETOS
ARG TARGETARCH
RUN GOOS=$TARGETOS GOARCH=$TARGETARCH CGO_ENABLED=0 go build ...
=======
FROM --platform=$BUILDPLATFORM golang:1.21-alpine AS build-go
>>>>>>> 8ef9292 (optimize docker file)

WORKDIR /app
COPY . .

# Compilation Go avec ccache et cross-compilation
RUN apt-get update && apt-get install -y ccache git && \
    export PATH="/usr/lib/ccache:$PATH" && \
    GOOS=$TARGETOS GOARCH=$TARGETARCH CGO_ENABLED=0 go build -o openmower-gui -ldflags="-s -w"

# ---------- Stage 2 : Web frontend with Bun ----------
FROM --platform=$BUILDPLATFORM debian:18-alpine AS build-web

RUN apt-get update && apt-get install -y curl unzip git ca-certificates && \
    rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

WORKDIR /web
COPY ./web .

RUN bun install && bun run build


# ---------- Stage 3 : PlatformIO + OpenOCD ----------
FROM --platform=$BUILDPLATFORM debian:bookworm-slim AS deps

ENV DEBIAN_FRONTEND=noninteractive

# Install build deps + pkg-config
RUN apt-get update && apt-get install -y \
    build-essential git python3 python3-pip python3-venv \
    libusb-1.0-0-dev libftdi-dev texinfo autoconf automake libtool \
    bash wget ccache curl unzip pkg-config \
    && rm -rf /var/lib/apt/lists/*

# OpenOCD (raspberrypi fork)
RUN git clone --recursive --branch rpi-common https://github.com/raspberrypi/openocd.git && \
    cd openocd && \
    mkdir -p m4 && \
    ln -s /usr/share/aclocal/pkg.m4 m4/pkg.m4 && \
    ./bootstrap && \
    ./configure \
        --enable-ftdi \
        --enable-sysfsgpio \
        --enable-bcm2835gpio \
        --enable-internal-jimtcl && \
    make -j$(nproc) && \
    make install && \
    cd .. && rm -rf openocd

# PlatformIO
RUN curl -fsSL https://raw.githubusercontent.com/platformio/platformio-core-installer/master/get-platformio.py -o get-platformio.py && \
    python3 get-platformio.py && \
    python3 -m pip install --no-cache-dir --break-system-packages --upgrade pygnssutils && \
    ln -s /root/.platformio/penv/bin/platformio /usr/local/bin/platformio && \
    ln -s /root/.platformio/penv/bin/pio /usr/local/bin/pio && \
    ln -s /root/.platformio/penv/bin/piodebuggdb /usr/local/bin/piodebuggdb && \
    rm get-platformio.py


# ---------- Stage 4 : Final image ----------
FROM debian:18-alpine

ENV WEB_DIR=/app/web
ENV DB_PATH=/app/db
WORKDIR /app

RUN apt-get update && apt-get install -y \
    ca-certificates python3 python3-pip libusb-1.0-0 ccache && \
    rm -rf /var/lib/apt/lists/*

COPY --from=deps /usr/local /usr/local
COPY --from=build-web /web/dist ./web
COPY --from=build-go /app/openmower-gui ./openmower-gui
COPY ./setup ./setup

CMD ["./openmower-gui"]
