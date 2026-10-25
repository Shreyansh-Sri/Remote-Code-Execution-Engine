# Use an available GCC tag (13‑bookworm is a slim‑ish variant)
FROM gcc:13-bookworm

# Create a non‑root sandbox user (UID 1000)
RUN useradd -m -u 1000 -s /bin/sh sandbox

WORKDIR /sandbox
USER sandbox

# The runner expects the compiled binary at /sandbox/solution
ENTRYPOINT ["/sandbox/solution"]
