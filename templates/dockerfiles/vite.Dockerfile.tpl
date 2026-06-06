# syntax=docker/dockerfile:1
# Build desde el directorio padre: docker build -f {{APP_SLUG}}/Dockerfile -t {{APP_NAME}} .

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine AS auth_sdk
WORKDIR /sdk
COPY boogiepop-auth-sdk/package.json boogiepop-auth-sdk/package-lock.json* ./
RUN npm ci 2>/dev/null || npm install
COPY boogiepop-auth-sdk/ .
RUN npm run build

FROM node:${NODE_VERSION}-alpine AS ui_pkg
WORKDIR /ui
COPY boogiepop-ui/package.json boogiepop-ui/package-lock.json* ./
RUN npm ci 2>/dev/null || npm install
COPY boogiepop-ui/ .

FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /workspace/app
COPY --from=auth_sdk /sdk /workspace/boogiepop-auth-sdk
COPY --from=ui_pkg /ui /workspace/boogiepop-ui
COPY {{APP_SLUG}}/package.json ./
RUN node -e "const fs=require('fs'),p=JSON.parse(fs.readFileSync('package.json')); \
  const d=p.dependencies||{}; \
  delete d['boogiepop-auth-sdk']; \
  d['@boogiepop/auth-sdk']='file:../boogiepop-auth-sdk'; \
  d['boogiepop-ui']='file:../boogiepop-ui'; \
  p.dependencies=d; \
  fs.writeFileSync('package.json',JSON.stringify(p,null,2))" && \
  npm install

FROM deps AS builder
WORKDIR /workspace/app
COPY {{APP_SLUG}}/ .

ARG VITE_REMOTE_BASE=/
ENV VITE_REMOTE_BASE=${VITE_REMOTE_BASE}

ARG NGINX_BASE_PATH={{APP_NAME}}
ENV NGINX_BASE_PATH=${NGINX_BASE_PATH}

ARG VITE_DEV_SERVER_ORIGIN=http://localhost:5173
ENV VITE_DEV_SERVER_ORIGIN=${VITE_DEV_SERVER_ORIGIN}

RUN npm run build

FROM nginx:1.27-alpine AS runner
ARG NGINX_BASE_PATH={{APP_NAME}}
RUN apk add --no-cache wget
WORKDIR /usr/share/nginx/html
RUN rm -rf ./*

COPY {{APP_SLUG}}/nginx.conf /etc/nginx/conf.d/default.conf
RUN sed -i "s|__BASE_PATH__|${NGINX_BASE_PATH}|g" /etc/nginx/conf.d/default.conf
COPY --from=builder /workspace/app/dist ./

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
