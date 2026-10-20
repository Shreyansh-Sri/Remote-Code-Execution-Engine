FROM gcc:13-slim
RUN useradd -m -u 65534 -s /bin/sh sandbox
WORKDIR /sandbox
USER sandbox
ENTRYPOINT ["/sandbox/solution"]
