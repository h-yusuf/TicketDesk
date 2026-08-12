FROM alpine:3.20

ARG PB_VERSION=0.22.21
ARG TARGETARCH

RUN apk add --no-cache unzip ca-certificates && \
    ARCH=$(case "$TARGETARCH" in \
      "amd64") echo "amd64" ;; \
      "arm64") echo "arm64" ;; \
      *) echo "$TARGETARCH" ;; \
    esac) && \
    wget "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${ARCH}.zip" -O /tmp/pb.zip && \
    unzip /tmp/pb.zip -d /pb && \
    rm /tmp/pb.zip && \
    apk del unzip

WORKDIR /pb
COPY pb_migrations ./pb_migrations
COPY pb_hooks ./pb_hooks

EXPOSE 8090
VOLUME ["/pb/pb_data"]

CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090"]
