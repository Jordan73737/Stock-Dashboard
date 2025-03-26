# Use Node.js base image
FROM node:18

# Set working directory
WORKDIR /app

# Copy only the backend files
COPY package*.json ./
COPY . .

# Install dependencies
RUN npm install

# Expose the port your app runs on
EXPOSE 5000

# Start the backend server
CMD ["node", "server.js"]
