# InvalidRecordsService Dockerfile
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
COPY ["src/Services/InvalidRecordsService/InvalidRecordsService.csproj", "InvalidRecordsService/"]
COPY ["src/Services/Shared/DataProcessing.Shared.csproj", "Shared/"]
RUN dotnet restore "InvalidRecordsService/InvalidRecordsService.csproj"

COPY ["src/Services/InvalidRecordsService/", "InvalidRecordsService/"]
COPY ["src/Services/Shared/", "Shared/"]

WORKDIR "/src/InvalidRecordsService"
RUN dotnet publish "InvalidRecordsService.csproj" -c Release -o /app/publish \
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
EXPOSE 5006
HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost:5006/health || exit 1

# OCP Compliance: Run as non-root user
USER 1000:1000

ENTRYPOINT ["dotnet", "InvalidRecordsService.dll"]
