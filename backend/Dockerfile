# Use Node.js LTS version
FROM node:18

# Set working directory inside container
WORKDIR /app

# Copy only backend files
COPY . .

# Install backend dependencies
RUN npm install

# Expose port used by Express
EXPOSE 5000

# Run your backend app
CMD ["node", "server.js"]
