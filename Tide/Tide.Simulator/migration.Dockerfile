FROM mcr.microsoft.com/dotnet/core/sdk:3.1 AS base
WORKDIR /app
ENV PATH="${PATH}:/root/.dotnet/tools:/opt/mssql-tools/bin"
RUN apt update && apt install -y gnupg2 netcat \
    && curl -sSL https://packages.microsoft.com/keys/microsoft.asc | apt-key add - \
    && curl -sSL https://packages.microsoft.com/config/debian/10/prod.list > /etc/apt/sources.list.d/mssql-release.list \
    && curl -sSL https://raw.githubusercontent.com/vishnubob/wait-for-it/master/wait-for-it.sh > ./wait-for-it.sh \
    && chmod +x wait-for-it.sh \
    && apt update \
    && ACCEPT_EULA=Y apt install -y msodbcsql17 mssql-tools \
    && dotnet new tool-manifest \
    && dotnet tool install --global dotnet-ef \
    && apt install nano

COPY ["Tide.Core/", "Tide.Core/"]
COPY ["Tide.Simulator/", "Tide.Simulator/"]
RUN dotnet-ef migrations script --idempotent --project "Tide.Simulator" --output "migration.sql"
RUN sed -i '1s/^...//' migration.sql \
    && sed -i "1s/^/CREATE DATABASE [db];\nGO\n\nUSE db;\nGO\n\n/" migration.sql \
    && sed -i "1s/^/IF NOT EXISTS(SELECT name FROM sys.sysdatabases where name='db')\n/" migration.sql

CMD ["bash", "-c", "for i in 1 2 3 4 5 6; do ( echo 'trying migrations' && sqlcmd -b -S ${SA_HOST:-127.0.0.1} -U sa -P ${SA_PASSWORD:-P@ssw0rd} -i migration.sql ) && sw=true && break || sleep 5; done && [[ $sw == true ]] && ( echo 'running service' && nc -l -p 80 && sleep infinity ) || ( echo 'error' && exit 1 ) "]