#!/bin/bash

set -e

# Function to wait for a service to be ready
wait_for_service() {
    local host="$1"
    local port="$2"
    local service="$3"
    
    echo "Waiting for $service to be ready..."
    while ! nc -z "$host" "$port"; do
        sleep 1
    done
    echo "$service is ready!"
}

# Create ghost user and group if they don't exist
echo "Setting up ghost user and group..."
groupadd -f node || true
useradd -r -g node -d /var/lib/ghost node || true

# Set up Ghost directory structure
echo "Setting up Ghost directory structure..."
GHOST_INSTALL_DIR="/var/lib/ghost"
GHOST_CONTENT_DIR="/var/lib/ghost/content"

# Create content directory and subdirectories if they don't exist
mkdir -p "$GHOST_CONTENT_DIR/themes"
mkdir -p "$GHOST_CONTENT_DIR/data"
mkdir -p "$GHOST_CONTENT_DIR/images"
mkdir -p "$GHOST_CONTENT_DIR/files"
mkdir -p "$GHOST_CONTENT_DIR/logs"

# Create source theme directory and subdirectories
mkdir -p "$GHOST_CONTENT_DIR/themes/source/assets/css"

# Copy themes
echo "Setting up Ghost themes..."
if [ -d "$GHOST_INSTALL_DIR/current/content/themes/casper" ]; then
    cp -r "$GHOST_INSTALL_DIR/current/content/themes/casper" "$GHOST_CONTENT_DIR/themes/"
fi

# Create source theme directory and add basic files
mkdir -p "$GHOST_CONTENT_DIR/themes/source"
cat > "$GHOST_CONTENT_DIR/themes/source/package.json" << 'EOF'
{
  "name": "source",
  "version": "1.0.0",
  "engines": {
    "ghost": ">=5.0.0"
  },
  "author": {
    "name": "VegasGuru",
    "email": "admin@vegasguru.com"
  }
}
EOF

cat > "$GHOST_CONTENT_DIR/themes/source/post.hbs" << 'EOF'
{{!< default}}
<main>
    <article class="post">
        <header>
            <h1>{{title}}</h1>
            {{#if feature_image}}
                <img src="{{feature_image}}" alt="{{title}}">
            {{/if}}
        </header>
        <section class="content">
            {{content}}
        </section>
    </article>
</main>
EOF

cat > "$GHOST_CONTENT_DIR/themes/source/page.hbs" << 'EOF'
{{!< default}}
<main>
    <article class="page">
        {{#if @page.show_title_and_feature_image}}
            <header>
                <h1>{{title}}</h1>
                {{#if feature_image}}
                    <img src="{{feature_image}}" alt="{{title}}">
                {{/if}}
            </header>
        {{/if}}
        <section class="content">
            {{content}}
        </section>
    </article>
</main>
EOF

cat > "$GHOST_CONTENT_DIR/themes/source/index.hbs" << 'EOF'
{{!< default}}
<main class="site-main">
    {{#foreach posts}}
    <article class="post-card {{post_class}}">
        <header class="post-card-header">
            {{#if feature_image}}
                <div class="post-card-image">
                    <img src="{{feature_image}}" alt="{{title}}"/>
                </div>
            {{/if}}
            <h2 class="post-card-title"><a href="{{url}}">{{title}}</a></h2>
        </header>
        <section class="post-card-excerpt">
            <p>{{excerpt}}</p>
        </section>
        <footer class="post-card-footer">
            <span class="post-card-author">{{primary_author.name}}</span>
            <time class="post-card-date" datetime="{{date format="YYYY-MM-DD"}}">
                {{date format="D MMM YYYY"}}
            </time>
        </footer>
    </article>
    {{/foreach}}
</main>

{{pagination}}
EOF

cat > "$GHOST_CONTENT_DIR/themes/source/assets/css/style.css" << 'EOF'
/* Basic styles */
body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
    line-height: 1.6;
    margin: 0;
    padding: 20px;
}

/* Post card styles */
.post-card {
    margin-bottom: 2rem;
    border: 1px solid #eee;
    padding: 1rem;
    border-radius: 4px;
}

.post-card-image img {
    width: 100%;
    height: auto;
}

.post-card-title {
    margin: 1rem 0;
}

.post-card-title a {
    color: #15171A;
    text-decoration: none;
}

.post-card-excerpt {
    color: #738a94;
}

.post-card-footer {
    margin-top: 1rem;
    color: #738a94;
    font-size: 0.9rem;
}

/* Koenig editor styles */
.kg-width-wide {
    position: relative;
    width: 85vw;
    min-width: 100%;
    margin: 0 auto;
    transform: translateX(calc(50% - 50vw));
}

.kg-width-full {
    position: relative;
    width: 100vw;
    left: 50%;
    right: 50%;
    margin-left: -50vw;
    margin-right: -50vw;
}
EOF

cat > "$GHOST_CONTENT_DIR/themes/source/default.hbs" << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{meta_title}}</title>
    <link rel="stylesheet" type="text/css" href="{{asset "css/style.css"}}" />
    {{ghost_head}}
</head>
<body>
    <div class="site-wrapper">
        {{{body}}}
    </div>
    {{ghost_foot}}
</body>
</html>
EOF

# Set proper ownership
chown -R node:node "$GHOST_CONTENT_DIR"
chown -R node:node "$GHOST_INSTALL_DIR"

# Set up npm environment
echo "Setting up npm environment..."
mkdir -p /home/node/.npm-global
chown -R node:node /home/node

# Create and configure .profile
cat > /home/node/.profile << 'EOF'
export PATH=/home/node/.npm-global/bin:$PATH
export NPM_CONFIG_PREFIX=/home/node/.npm-global
EOF

chown node:node /home/node/.profile

# Wait for MySQL to be ready
echo "Waiting for MySQL..."
wait_for_service db 3306 "MySQL"

# Start Ghost
echo "Starting Ghost..."
cd "$GHOST_INSTALL_DIR"
su node -c "bash -c 'source /home/node/.profile && NODE_ENV=production ghost run'"

# Start FastAPI backend
echo "Starting FastAPI backend..."
cd /app
. /app/venv/bin/activate
python3 -m uvicorn src.services.api_server:app --host 0.0.0.0 --port 8000 --reload &

# Start frontend
echo "Starting frontend..."
cd /app
su node -c "bash -c 'source /home/node/.profile && npm run dev'" &

# Wait for services to be ready
wait_for_service 0.0.0.0 2368 "Ghost"
wait_for_service 0.0.0.0 8000 "FastAPI"
wait_for_service 0.0.0.0 5173 "Frontend"

echo "All services are running!"

# Keep container running and monitor logs
tail -f /var/lib/ghost/content/logs/ghost.log