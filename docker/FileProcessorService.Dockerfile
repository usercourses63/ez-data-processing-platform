# FileProcessorService Dockerfile
# Multi-stage build for .NET 10 service with version injection

# Version injection (CI/CD)
ARG VERSION=0.0.0
ARG COMMIT_SHA=unknown

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Redeclare ARGs for build stage
ARG VERSION
ARG COMMIT_SHA

COPY ["Directory.Packages.props", "./"]
COPY ["Directory.Build.props", "./"]
COPY ["global.json", "./"]
COPY ["src/Services/FileProcessorService/DataProcessing.FileProcessor.csproj", "FileProcessorService/"]
COPY ["src/Services/Shared/DataProcessing.Shared.csproj", "Shared/"]

RUN dotnet restore "FileProcessorService/DataProcessing.FileProcessor.csproj"

COPY ["src/Services/FileProcessorService/", "FileProcessorService/"]
COPY ["src/Services/Shared/", "Shared/"]

WORKDIR "/src/FileProcessorService"
RUN dotnet publish "DataProcessing.FileProcessor.csproj" -c Release -o /app/publish \
    /p:Version=${VERSION} \
    /p:InformationalVersion=${VERSION}+${COMMIT_SHA}

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app

# Redeclare ARGs for runtime stage labels
ARG VERSION
ARG COMMIT_SHA
LABEL org.opencontainers.image.version="${VERSION}"
LABEL org.opencontainers.image.revision="${COMMIT_SHA}"

COPY --from=build /app/publish .

EXPOSE 5008

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5008/health || exit 1

ENTRYPOINT ["dotnet", "DataProcessing.FileProcessor.dll"]
