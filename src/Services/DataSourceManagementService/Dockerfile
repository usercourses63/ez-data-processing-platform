# Multi-stage Dockerfile for DataSourceManagementService

# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy project files
COPY src/Services/Shared/DataProcessing.Shared.csproj src/Services/Shared/
COPY src/Services/DataSourceManagementService/DataProcessing.DataSourceManagement.csproj src/Services/DataSourceManagementService/
COPY Directory.Build.props .
COPY Directory.Packages.props .

# Restore dependencies
RUN dotnet restore src/Services/DataSourceManagementService/DataProcessing.DataSourceManagement.csproj

# Copy source code
COPY src/Services/Shared/ src/Services/Shared/
COPY src/Services/DataSourceManagementService/ src/Services/DataSourceManagementService/

# Build
WORKDIR /src/src/Services/DataSourceManagementService
RUN dotnet build DataProcessing.DataSourceManagement.csproj -c Release -o /app/build

# Publish
FROM build AS publish
RUN dotnet publish DataProcessing.DataSourceManagement.csproj -c Release -o /app/publish /p:UseAppHost=false

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

# OCP Compliance: Run as non-root user
USER 1000:1000

COPY --from=publish --chown=1000:1000 /app/publish .

ENV ASPNETCORE_URLS=http://+:5001
ENV ASPNETCORE_ENVIRONMENT=Production

EXPOSE 5001

ENTRYPOINT ["dotnet", "DataSourceManagementService.dll"]
