SHELL := /bin/bash
.PHONY: deps build run-gui run-backend run clean docker-up docker-down logs

CURRENT_DIR := $(shell pwd)

# 🚀 Installation des dépendances Go + frontend
deps:
	cd $(CURRENT_DIR)/web && yarn install --frozen-lockfile
	cd $(CURRENT_DIR) && go mod download

# 🧱 Build de l'image Docker
build:
	docker build -t openmower-gui .

# 🌐 Lancer uniquement le frontend (React/Vite) en dev
run-gui:
	cd $(CURRENT_DIR)/web && yarn dev --host

# ⚙️ Lancer uniquement le backend Go en local
run-backend:
	CGO_ENABLED=0 go run main.go

# ⚡ Lancer frontend + backend en parallèle (hors Docker)
run:
	make -j2 run-backend run-gui

# 🧹 Nettoyer tous les fichiers générés (comme .gitignore)
clean:
	rm -rf \
		web/node_modules \
		web/dist \
		web/.vite \
		venv \
		__pycache__ \
		.pio \
		.pioenvs \
		.piolibdeps \
		build \
		bin \
		*.out \
		*.test \
		*.log \
		*.pyc \
		*.pyo \
		*.pyd \
		web/yarn-error.log \
		package-lock.json \
		bun.lockb

# 🐳 Docker Compose Up
docker-up:
	docker compose up -d

# 🐳 Docker Compose Down
docker-down:
	docker compose down

# 📜 Logs Docker UI
logs:
	docker logs -f openmower-gui
