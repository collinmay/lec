import WebSocket, { WebSocketServer } from "ws";
import amqp from "amqplib";

const amqp_server = "placeholder";

const wss_countdown   = new WebSocketServer({port: 9293});
const wss_leaderboard = new WebSocketServer({port: 9294});

const e_countdown = "countdown";
const e_leaderboard = "leaderboard";

amqp.connect(amqp_server).then((conn) => {
	return conn.createChannel();
}).then((ch) => {
	return Promise.all([
		ch.assertExchange(e_countdown, "fanout", {durable: false}),
		ch.assertExchange(e_leaderboard, "fanout", {durable: false}),
		ch.assertQueue("", {exclusive: true}),
		ch.assertQueue("", {exclusive: true})
	]).then((results) => {
		const q_countdown = results[2];
		const q_leaderboard = results[3];
		return Promise.all([
			ch.bindQueue(q_countdown.queue, e_countdown, ""),
			ch.bindQueue(q_leaderboard.queue, e_leaderboard, "")
		]).then(_ => {
			return {q_countdown, q_leaderboard};
		});
	}).then((q) => {
		return Promise.any([
			ch.consume(q.q_countdown.queue, (msg) => {
				wss_countdown.clients.forEach(c => {
					if(c.readyState === WebSocket.OPEN) {
						c.send(msg.content.toString());
					};
				});
				return ch.ack(msg);
			}),
			ch.consume(q.q_leaderboard.queue, (msg) => {
				wss_leaderboard.clients.forEach(c => {
					if(c.readyState === WebSocket.OPEN) {
						c.send(msg.content.toString());
					};
				});
				return ch.ack(msg);
			})
		]);
	});
}).catch(console.warn);

/* Ping all our clients every once in a while so we can drop dead connections. */

[wss_countdown, wss_leaderboard].forEach(wss => {
	wss.on("connection", ws => {
		ws.isAlive = true;
		ws.on("pong", _ => ws.isAlive = true);
	});

	const interval = setInterval(function ping() {
		wss.clients.forEach(function each(ws) {
			if (ws.isAlive === false) return ws.terminate();

			ws.isAlive = false;
			ws.ping();
		});
	}, 30000);

	wss.on('close', function close() {
		clearInterval(interval);
	});
});
