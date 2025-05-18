# Étape 1 : Build Go pour ARM64
FROM --platform=linux/arm64 golang:1.21 AS build-go
WORKDIR /app
COPY . /app
RUN CGO_ENABLED=0 go build -o openmower-gui

# Étape 2 : Build WebUI pour ARM64
FROM --platform=linux/arm64 node:18 AS build-web
WORKDIR /web
COPY ./web /web
RUN yarn install --frozen-lockfile && yarn build

# Étape 3 : Dépendances outils (OpenOCD, PlatformIO)
FROM --platform=linux/arm64 ubuntu:22.04 AS deps

# Install minimal + nettoyage
RUN apt-get update && apt-get install -y \
  ca-certificates curl python3 python3-pip python3-venv git \
  build-essential unzip wget autoconf automake pkg-config \
  libtool libftdi-dev libusb-1.0-0-dev rpi.gpio-common && \
  apt-get clean && rm -rf /var/lib/apt/lists/*

# OpenOCD custom
RUN git clone https://github.com/raspberrypi/openocd.git --recursive --branch rp2040 --depth=1 && \
  cd openocd && ./bootstrap && ./configure --enable-ftdi --enable-sysfsgpio --enable-bcm2835gpio && \
  make -j$(nproc) && make install && cd .. && rm -rf openocd

# PlatformIO
RUN curl -fsSL https://raw.githubusercontent.com/platformio/platformio-core-installer/master/get-platformio.py -o get-platformio.py && \
  python3 get-platformio.py && \
  python3 -m pip install --upgrade pygnssutils && \
  ln -sf ~/.platformio/penv/bin/platformio /usr/local/bin/platformio && \
  ln -sf ~/.platformio/penv/bin/pio /usr/local/bin/pio && \
  ln -sf ~/.platformio/penv/bin/piodebuggdb /usr/local/bin/piodebuggdb

# Étape 4 : Image finale pour exécution sur le Raspberry Pi
FROM --platform=linux/arm64 ubuntu:22.04
ENV WEB_DIR=/app/web
ENV DB_PATH=/app/db
WORKDIR /app

# Copie des binaires et fichiers nécessaires
COPY --from=deps /usr/local /usr/local
COPY --from=build-web /web/dist /app/web
COPY --from=build-go /app/openmower-gui /app/openmower-gui
COPY ./setup /app/setup

CMD ["/app/openmower-gui"]
