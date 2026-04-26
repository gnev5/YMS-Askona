ARG NODE_IMAGE=node:20-alpine
FROM ${NODE_IMAGE}
WORKDIR /app
COPY package.json package-lock.json ./
# Allow builds behind corporate/self-signed proxies
RUN npm config set strict-ssl false
RUN npm config set registry https://registry.npmjs.org/
RUN npm config set fetch-retries 5 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm ci --no-audit --no-fund
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]
