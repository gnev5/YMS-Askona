FROM node:20-alpine
WORKDIR /app
COPY package.json ./
# Allow builds behind corporate/self-signed proxies
RUN npm config set strict-ssl false
RUN npm config set registry https://registry.npmjs.org/
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]
