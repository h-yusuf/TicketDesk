FROM node:20-alpine AS build
WORKDIR /app
# If unset, the app falls back to window.location.origin at runtime —
# only pass this when frontend and backend are NOT served from the same
# origin (e.g. direct IP:port testing, or a separate API subdomain).
ARG VITE_POCKETBASE_URL
ENV VITE_POCKETBASE_URL=${VITE_POCKETBASE_URL}
COPY package.json package-lock.json* ./
COPY web/package.json ./web/
RUN npm install --workspace=web
COPY web ./web
RUN npm run build --workspace=web

FROM nginx:alpine
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 80
