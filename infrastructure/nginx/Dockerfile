# apache2-utils gives us `htpasswd`, used by this image's entrypoint (see
# docker-compose.yml's nginx service command) to generate /etc/nginx/.htpasswd
# from ALERTMANAGER_ADMIN_PASSWORD at container startup - the nginx:alpine
# base ships neither `htpasswd` nor `openssl`. Installed here at BUILD time
# (baked into the image) instead of in the entrypoint, so `docker compose up`
# never depends on network access to the Alpine package mirror at runtime.
FROM nginx:1.27-alpine

RUN apk add --no-cache apache2-utils
