# Lettuce Eating Competition Leaderboard

## Setup for Development

1. Set up a RabbitMQ server. I didn't feel like running it on my laptop, so I
use CloudAMQP.

2. Set up a database, or don't and just use sqlite in-memory.

3. Create config.yml like so:

```
aqmp_url: amqp://your-message-queue-server
base_url: http://localhost:9292
ws_countdown_url: ws://localhost:9293
ws_leaderboard_url: ws://localhost:9294
db_url: sqlite://
reset_test_data: true
```

4. Run the websocket endpoint with `npm exec node wsendpoint.js`.

5. Run the web server with `bundle exec rackup --host 0.0.0.0`.

## After modifying Javascript

You have to run `npm exec -- babel -d public/js/ js/` to rebuild the
Javascript. I know there are better ways to do this but I also didn't really
care because it's not that much Javascript.

## Deployment Considerations

I run the application under Passenger + Nginx with an nginx config like this:

```
    server {
        listen 443 ssl http2;

        server_name lec.cdmay.net;

        root /srv/www/lec/public;

	location /ws/countdown {
		 proxy_pass http://localhost:9293;
		 proxy_http_version 1.1;
		 proxy_set_header Upgrade $http_upgrade;
		 proxy_set_header Connection "Upgrade";
		 proxy_set_header Host $host;
	}

	location /ws/leaderboard {
		 proxy_pass http://localhost:9294;
		 proxy_http_version 1.1;
		 proxy_set_header Upgrade $http_upgrade;
		 proxy_set_header Connection "Upgrade";
		 proxy_set_header Host $host;
	}

        passenger_enabled on;
        passenger_ruby /usr/bin/ruby;
        passenger_min_instances 1;
        passenger_spawn_method direct;
        passenger_set_header X-Forwarded-Proto https;

        client_max_body_size 0;
    
        ssl_certificate /etc/letsencrypt/live/lec.cdmay..net/fullchain.pem; # managed by Certbot
        ssl_certificate_key /etc/letsencrypt/live/lec.cdmay.net/privkey.pem; # managed by Certbot
    }

    passenger_pre_start https://lec.cdmay.net/;
```

And an application (`config.yml`) config like this:

```
aqmp_url: amqp://PLACEHOLDER
base_url: https://lec.cdmay.net
ws_countdown_url: wss://lec.cdmay.net/ws/countdown
ws_leaderboard_url: wss://lec.cdmay.net/ws/leaderboard
db_url: mysql2://lec:PLACEHOLDER@localhost/lec
reset_test_data: false
```

Make sure `reset_test_data` is false, otherwise it will totally clobber over your database on every startup.