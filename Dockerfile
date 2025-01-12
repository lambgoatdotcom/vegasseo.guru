# Build stage for frontend
FROM node:18 AS frontend-build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Backend stage
FROM python:3.9 AS backend
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY src/ ./src/
ENV PYTHONPATH=/app

# Ghost stage
FROM ghost:5.105.0 AS ghost

# Final stage
FROM node:18-slim
WORKDIR /app

# Copy built frontend
COPY --from=frontend-build /app/dist ./dist

# Copy backend
COPY --from=backend /app ./
COPY --from=backend /usr/local/lib/python3.9/site-packages /usr/local/lib/python3.9/site-packages

# Copy Ghost
COPY --from=ghost /var/lib/ghost /var/lib/ghost

# Install serve for frontend
RUN npm install -g serve

# Copy start script
COPY start.sh .
RUN chmod +x start.sh

EXPOSE 5173 8000 2368
CMD ["./start.sh"] 