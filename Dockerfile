FROM node:20-slim

WORKDIR /app

# Install curl for downloading extism-js
RUN apt-get update && apt-get install -y curl

# Copy package files first (for better layer caching)
COPY package.json package-lock.json ./

# Install dependencies but skip prepare script for now
RUN npm ci --ignore-scripts

# Install extism-js
RUN curl -L https://raw.githubusercontent.com/extism/js-pdk/main/install.sh | bash

# Copy the rest of the application
COPY . .

# Now run the build
RUN npm run build

# Set the entrypoint
CMD ["node", "dist/index.js"]