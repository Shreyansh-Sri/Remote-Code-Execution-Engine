FROM node:20-slim
RUN useradd -m -u 65534 -s /bin/sh sandbox
WORKDIR /sandbox
USER sandbox
ENTRYPOINT ["node", "/sandbox/solution.js"]
