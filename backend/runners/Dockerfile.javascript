FROM node:20-slim

# UID 1001 because node:20-slim already occupies UID 1000
RUN useradd -m -u 1001 -s /bin/sh sandbox

WORKDIR /sandbox
USER sandbox

ENTRYPOINT ["node", "/sandbox/solution.js"]
