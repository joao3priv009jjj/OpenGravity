FROM node:20-alpine

# Crie o diretório de trabalho
WORKDIR /usr/src/app

# Copie os arquivos de dependência
COPY package*.json ./

# Instale as dependências (incluindo devDependencies como tsx e typescript)
RUN npm install

# Copie o restante do código da aplicação
COPY . .

# Comando para iniciar o bot
CMD [ "npm", "run", "start" ]
