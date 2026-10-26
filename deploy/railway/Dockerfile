# Public showcase only. The Docker-backed native execution host stays separate.
FROM nginx:alpine
ENV PORT=8080
COPY site/ /usr/share/nginx/html/
COPY deploy/railway/default.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 8080
