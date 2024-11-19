# Use Python as base image
FROM python:3.12-slim AS builder

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive \
    PATH="/root/.cargo/bin:${PATH}" \
    RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    pkg-config \
    libssl-dev \
    libffi-dev \
    python3-dev \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Rust toolchain
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y \
    && . $CARGO_HOME/env \
    && rustup update \
    && rustup default stable

# Create final image
FROM python:3.12-slim

# Copy Rust installations from builder
COPY --from=builder /usr/local/rustup /usr/local/rustup
COPY --from=builder /usr/local/cargo /usr/local/cargo

# Set environment variables for Rust
ENV PATH="/usr/local/cargo/bin:${PATH}" \
    RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libssl3 \
    openssl \
    git \
    curl \
    pkg-config \
    build-essential \
    python3-dev \
    libffi-dev \
    mecab \
    mecab-ipadic \
    libmecab-dev \
    swig \
    && rm -rf /var/lib/apt/lists/*

# Install additional audio processing dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy application code
COPY . .

# Install Python dependencies and MeloTTS
RUN python3 -m pip install --no-cache-dir wheel setuptools maturin \
    && python3 -m pip install --no-cache-dir --no-binary :all: tokenizers \
    && python3 -m pip install --no-cache-dir torch torchaudio numpy \
    && python3 -m pip install -e .

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

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    TRANSFORMERS_CACHE=/app/.cache/huggingface \
    HF_HOME=/app/.cache/huggingface

# Create and set permissions for cache directories
RUN mkdir -p /app/.cache/huggingface \
    && chmod -R 777 /app/.cache

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -k --fail https://localhost:5000/ || exit 1

# Run the application
CMD ["python3", "app.py"]
