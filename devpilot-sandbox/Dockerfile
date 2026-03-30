# Start from the official Playwright focal image
FROM mcr.microsoft.com/playwright:v1.40.0-focal

# Create a non-root user
RUN useradd -m -s /bin/bash devpilot

# Set the working directory
WORKDIR /app

# Copy application files
COPY . .

# Ensure alternate package managers are available in the runtime
RUN npm install -g pnpm yarn

# Install all dependencies (including devDependencies like tsc)
RUN npm install
# Build the application
RUN npm run build

# Set environment variables for runtime
ENV NODE_ENV=production
ENV PORT=8080

# Ensure correct permissions for the devpilot user
RUN chown -R devpilot:devpilot /app

# Switch to non-root user
USER devpilot

# Expose the API port
EXPOSE 8080

# Start the Node.js API server
CMD ["node", "dist/index.js"]
