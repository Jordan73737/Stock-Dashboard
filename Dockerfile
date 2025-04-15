# ---- Build Stage ----
  FROM node:18 AS builder

  WORKDIR /app
  COPY package*.json ./
  RUN npm install
  COPY . .
  RUN npm run build
  
  # ---- Production Stage ----
  FROM node:18 AS production
  
  WORKDIR /app
  
  # Install serve (static file server)
  RUN npm install -g serve
  
  # Copy built files from builder stage
  COPY --from=builder /app/dist ./dist
  
  # Expose the port for serving (default: 3000)
  EXPOSE 3000
  
  # Serve the built site
  CMD ["serve", "-s", "dist", "-l", "3000"]
  