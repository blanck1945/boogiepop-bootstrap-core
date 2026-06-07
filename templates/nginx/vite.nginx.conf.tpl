server {
    listen 8080;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location = /favicon.ico {
        alias /usr/share/nginx/html/favicon.svg;
        default_type image/svg+xml;
        add_header Cache-Control "public, max-age=86400" always;
    }
    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;

    add_header Cross-Origin-Resource-Policy "cross-origin" always;

    location /health {
        access_log off;
        default_type text/plain;
        return 200 'ok';
    }

    location = /__BASE_PATH__/health {
        access_log off;
        default_type text/plain;
        return 200 'ok';
    }

    location ^~ /__BASE_PATH__/ {
        alias /usr/share/nginx/html/;
        add_header Cross-Origin-Resource-Policy "cross-origin" always;
        add_header Access-Control-Allow-Origin "*" always;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(?:js|mjs|css|wasm|woff2)$ {
        expires 7d;
        add_header Cache-Control "public";
    }
}
