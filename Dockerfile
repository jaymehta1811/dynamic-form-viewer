# Use Node lightweight image
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy rest of project
COPY . .

# Expose Vite default port
EXPOSE 5173

# Run Vite dev server
CMD ["npm", "run", "dev", "--", "--host"]
