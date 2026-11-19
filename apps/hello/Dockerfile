FROM node:24-alpine AS build
WORKDIR /src
RUN corepack enable && corepack prepare pnpm@12.21.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/jsctrls packages/jsctrls
COPY apps/hello apps/hello
RUN pnpm install --frozen-lockfile
RUN pnpm --filter hello build

FROM nginx:1.27-alpine
COPY apps/hello/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/apps/hello/dist /usr/share/nginx/html
EXPOSE 80
