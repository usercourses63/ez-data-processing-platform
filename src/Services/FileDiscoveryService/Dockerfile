# Multi-stage Dockerfile for FileDiscoveryService

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY src/Services/Shared/DataProcessing.Shared.csproj src/Services/Shared/
COPY src/Services/FileDiscoveryService/DataProcessing.FileDiscovery.csproj src/Services/FileDiscoveryService/
COPY Directory.Build.props .
COPY Directory.Packages.props .

RUN dotnet restore src/Services/FileDiscoveryService/DataProcessing.FileDiscovery.csproj

COPY src/Services/Shared/ src/Services/Shared/
COPY src/Services/FileDiscoveryService/ src/Services/FileDiscoveryService/

WORKDIR /src/src/Services/FileDiscoveryService
RUN dotnet build DataProcessing.FileDiscovery.csproj -c Release -o /app/build

FROM build AS publish
RUN dotnet publish DataProcessing.FileDiscovery.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
USER 1000:1000
COPY --from=publish --chown=1000:1000 /app/publish .

ENV ASPNETCORE_URLS=http://+:5006
ENV ASPNETCORE_ENVIRONMENT=Production

EXPOSE 5006

ENTRYPOINT ["dotnet", "DataProcessing.FileDiscovery.dll"]
