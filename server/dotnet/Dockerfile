FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY . .
RUN dotnet publish src/Jsctrls.Demo.csproj -c Release -o /out

FROM mcr.microsoft.com/dotnet/aspnet:10.0
# The aspnet image already has a non-root "app" user; only curl (for the Compose healthcheck) is added.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build --chown=app:app /out .
USER app
ENV SERVER_PORT=8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "Jsctrls.Demo.dll"]
