FROM node:20-slim AS base

# Install dependencies for PaddleOCR, Sharp, and PDF processing
RUN apt-get update && apt-get install -y \
    ghostscript \
    libvips-dev \
    python3 \
    python3-pip \
    python3-dev \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libgl1-mesa-glx \
    build-essential \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install PaddleOCR and dependencies
# Pin numpy to 1.x for OpenCV compatibility
RUN pip3 install --no-cache-dir --break-system-packages \
    "numpy<2.0" \
    paddlepaddle==2.6.2 \
    paddleocr==2.7.3 \
    shapely \
    pyclipper \
    imgaug \
    lmdb \
    tqdm \
    visualdl \
    rapidfuzz \
    opencv-python-headless \
    opencv-contrib-python-headless \
    Pillow

# Pre-download PaddleOCR language models during build
# Copy download script first
COPY download_models.py /tmp/download_models.py

# Download language models (most common European languages)
RUN python3 /tmp/download_models.py && rm /tmp/download_models.py

# Set working directory
WORKDIR /app

# Copy package files and prisma template
COPY package*.json ./
COPY prisma/schema.template.prisma ./prisma/schema.template.prisma
COPY scripts/prisma-provider.mjs ./scripts/prisma-provider.mjs

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Make Python OCR script executable
RUN chmod +x /app/paddle_ocr.py

# Generate Prisma schema for PostgreSQL and Prisma Client
# (Docker always uses PostgreSQL; --no-push skips db push during build)
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN node scripts/prisma-provider.mjs --no-push

# Build Next.js app
RUN npm run build

# Expose port
EXPOSE 3000

# Start command (will be overridden in docker-compose for worker)
CMD ["npm", "start"]
