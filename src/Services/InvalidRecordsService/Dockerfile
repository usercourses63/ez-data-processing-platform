# Multi-stage Dockerfile for InvalidRecordsService

# Build stage
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy project files
COPY src/Services/Shared/DataProcessing.Shared.csproj src/Services/Shared/
COPY src/Services/InvalidRecordsService/InvalidRecordsService.csproj src/Services/InvalidRecordsService/
COPY Directory.Build.props .
COPY Directory.Packages.props .

# Override target framework to .NET 9.0 for Docker compatibility
RUN sed -i 's/net10.0/net9.0/g' Directory.Build.props

# Restore dependencies
RUN dotnet restore src/Services/InvalidRecordsService/InvalidRecordsService.csproj

# Copy source code
COPY src/Services/Shared/ src/Services/Shared/
COPY src/Services/InvalidRecordsService/ src/Services/InvalidRecordsService/

# Build
WORKDIR /src/src/Services/InvalidRecordsService
RUN dotnet build InvalidRecordsService.csproj -c Release -o /app/build

# Publish
FROM build AS publish
RUN dotnet publish InvalidRecordsService.csproj -c Release -o /app/publish /p:UseAppHost=false

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
COPY --from=publish /app/publish .

ENV ASPNETCORE_URLS=http://+:5007
ENV ASPNETCORE_ENVIRONMENT=Production

EXPOSE 5007

# OCP Compliance: Run as non-root user
USER 1000:1000

ENTRYPOINT ["dotnet", "InvalidRecordsService.dll"]
