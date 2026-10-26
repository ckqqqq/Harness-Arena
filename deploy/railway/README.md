# Railway showcase service

This deploys only the public gallery in `site/`. It is not the Docker-backed four-harness execution host. No model key, access token, volume or database is required.

Use the repository root as the build context. Set the service's Dockerfile path to `deploy/railway/Dockerfile` and health-check path to `/healthz` using Railway service settings. That selects the showcase Dockerfile rather than the Linux task runtime image. Legacy `railway.json` configuration is deprecated by the current Railway API. The Nginx entrypoint expands Railway's `PORT`; generate a public domain targeting that port after deployment succeeds.

Images and videos have one-hour cache lifetimes. HTML is revalidated. Nginx supports normal MP4 byte-range responses. Videos in the gallery use `preload="none"` and a small poster, so browsing the wall does not download every full movie at once. The service contains only curated public assets copied at build time; private generation data remains on the execution host.

Local equivalent:

```sh
docker build -t arena-gallery -f deploy/railway/Dockerfile .
docker run --rm -e PORT=8080 -p 8080:8080 arena-gallery
```

The base image follows `nginx:alpine`; rebuilds may include upstream changes. Railway configuration is an optional deployment target. GitHub Pages remains available independently.
