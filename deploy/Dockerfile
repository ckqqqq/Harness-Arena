FROM ubuntu:24.04
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash ca-certificates curl git libstdc++6 python3 python3-venv ripgrep \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /work
CMD ["/bin/bash"]
