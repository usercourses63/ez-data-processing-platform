# FileDiscoveryService Dockerfile
# Multi-stage build for .NET 10 service with version injection

# Version injection (CI/CD)
ARG VERSION=0.0.0
ARG COMMIT_SHA=unknown

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Redeclare ARGs for build stage
ARG VERSION
ARG COMMIT_SHA

# Copy .NET configuration files
COPY ["Directory.Packages.props", "./"]
COPY ["Directory.Build.props", "./"]
COPY ["global.json", "./"]

# Copy project files
COPY ["src/Services/FileDiscoveryService/DataProcessing.FileDiscovery.csproj", "FileDiscoveryService/"]
COPY ["src/Services/Shared/DataProcessing.Shared.csproj", "Shared/"]

# Restore dependencies
RUN dotnet restore "FileDiscoveryService/DataProcessing.FileDiscovery.csproj"

# Copy source code
COPY ["src/Services/FileDiscoveryService/", "FileDiscoveryService/"]
COPY ["src/Services/Shared/", "Shared/"]

# Build and publish
WORKDIR "/src/FileDiscoveryService"
RUN dotnet publish "DataProcessing.FileDiscovery.csproj" -c Release -o /app/publish \
    /p:Version=${VERSION} \
    /p:InformationalVersion=${VERSION}+${COMMIT_SHA}

# Runtime image
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app

# Redeclare ARGs for runtime stage labels
ARG VERSION
ARG COMMIT_SHA
LABEL org.opencontainers.image.version="${VERSION}"
LABEL org.opencontainers.image.revision="${COMMIT_SHA}"

COPY --from=build /app/publish .

# OCP arbitrary-UID compliance: group-0 owns a group-writable /app + HOME so a random UID can write DataProtection keys
ENV HOME=/app
RUN chgrp -R 0 /app && chmod -R g=u /app
USER 1001

# Expose port
EXPOSE 5007

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5007/health || exit 1

ENTRYPOINT ["dotnet", "DataProcessing.FileDiscovery.dll"]
