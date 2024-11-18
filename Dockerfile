# Use NVIDIA CUDA as base image for GPU support
FROM nvidia/cuda:12.6.1-cudnn-devel-ubuntu24.04 as builder

# Set environment variables
ENV PYTHON_VERSION=3.10.12 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive \
    PATH="/root/.cargo/bin:${PATH}" \
    RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    zlib1g-dev \
    libncurses5-dev \
    libgdbm-dev \
    libnss3-dev \
    libssl-dev \
    libreadline-dev \
    libffi-dev \
    libsqlite3-dev \
    libbz2-dev \
    wget \
    git \
    curl \
    pkg-config \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Rust toolchain
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y \
    && . $CARGO_HOME/env \
    && rustup update \
    && rustup default stable

# Build Python from source
RUN wget https://www.python.org/ftp/python/${PYTHON_VERSION}/Python-${PYTHON_VERSION}.tgz \
    && tar xzf Python-${PYTHON_VERSION}.tgz \
    && cd Python-${PYTHON_VERSION} \
    && ./configure --enable-optimizations \
    && make -j$(nproc) \
    && make install \
    && cd .. \
    && rm -rf Python-${PYTHON_VERSION}* \
    && python3 -m ensurepip \
    && python3 -m pip install --no-cache-dir --upgrade pip wheel setuptools

# Set Python 3.10 as default
RUN update-alternatives --install /usr/bin/python python /usr/local/bin/python3 1 \
    && update-alternatives --install /usr/bin/python3 python3 /usr/local/bin/python3 1

# Create final image
FROM nvidia/cuda:12.6.1-cudnn-runtime-ubuntu24.04

# Copy Python and Rust installations from builder
COPY --from=builder /usr/local /usr/local
COPY --from=builder /usr/local/rustup /usr/local/rustup
COPY --from=builder /usr/local/cargo /usr/local/cargo

# Set environment variables for Rust
ENV PATH="/usr/local/cargo/bin:${PATH}" \
    RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsqlite3-0 \
    libssl3 \
    openssl \
    git \
    curl \
    pkg-config \
    build-essential \
    python3-dev \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# Install Python dependencies
RUN python3 -m pip install --no-cache-dir wheel setuptools \
    && python3 -m pip install --no-cache-dir --no-binary :all: tokenizers \
    && python3 -m pip install --no-cache-dir torch numpy \
    && python3 -m pip install --no-cache-dir -r requirements.txt

# Install additional audio processing dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy application code
COPY . .

# Generate SSL certificates
RUN openssl req -x509 -newkey rsa:2048 \
    -keyout key.pem -out cert.pem \
    -days 365 -nodes \
    -subj "/CN=*"

# Create necessary directories with proper permissions
RUN mkdir -p /app/temp \
    && chmod -R 777 /app/temp

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -k --fail https://localhost:5000/ || exit 1

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    TRANSFORMERS_CACHE=/app/.cache/huggingface \
    HF_HOME=/app/.cache/huggingface

# Create and set permissions for cache directories
RUN mkdir -p /app/.cache/huggingface \
    && chmod -R 777 /app/.cache

# Run the application
CMD ["python3", "app.py"]
