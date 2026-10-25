FROM ubuntu:24.04
RUN apt-get update && apt-get install -y --no-install-recommends \
    blender bash ca-certificates curl git libstdc++6 python3 python3-venv python3-pil python3-numpy ripgrep ffmpeg fonts-noto-cjk fontconfig unzip \
    libasound2t64 libatk-bridge2.0-0t64 libatk1.0-0t64 libatspi2.0-0t64 libcairo2 libcups2t64 libdbus-1-3 \
    libdrm2 libgbm1 libglib2.0-0t64 libnspr4 libnss3 libpango-1.0-0 libx11-6 libxcb1 libxcomposite1 \
    libxdamage1 libxext6 libxfixes3 libxkbcommon0 libxrandr2 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /work
CMD ["/bin/bash"]
