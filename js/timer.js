/* yeah this is kinda shitty but it's javascript soooo... */

function reloadSetPoint() {
	return fetch("/api/countdown").then(rs => rs.json()).then(rs => {
		return {setPoint: rs.set_point, active: rs.active};
	});
};

let timerElementPromise = new Promise((resolve, reject) => {
	window.addEventListener("load", _ => {
		resolve(document.getElementById("timer"));
	});
});

function formatForTimer(seconds, type) {
	if(type == "countdown") {
		return Math.floor(seconds).toString();
	} else if(type == "stopwatch") {
		let str = "";
		str+= Math.floor(seconds / 60).toString().padStart(2, "0");
		str+= ":";
		str+= Math.floor(seconds % 60).toString().padStart(2, "0");
		str+= ".";
		str+= Math.floor(seconds * 1000.0 % 1000.0).toString().padStart(3, "0");
		return str;
	} else if(type == "score") {
		let str = "";
		str+= Math.floor(seconds / 60).toString();
		str+= ":";
		str+= Math.floor(seconds % 60).toString().padStart(2, "0");
		return str;
	}
}

class TimerWidget {
	/* Valid states:
	     - "reset"
	     - "countdown"
	     - "stopwatch"
	*/
	
	constructor(element, ws) {
		this.element = element;
		this.ws = ws;
		this.state = "reset";
		this.active = false;
		this.setPoint = null;

		this.subscribers = [];

		/* Subscribe to remote control commands */
		this.ws.addEventListener("message", msg => {
			if(msg.data == "set") {
				this.reload().catch(e => window.alert(e));
			} else if(msg.data == "begin") {
				this.remoteArm();
			} else if(msg.data == "cancel") {
				this.remoteDisarm();
			} else {
				window.alert("unknown command from server: " + msg.data);
			}
		});
		
		this.reload();
	}

	updateView() {
		let now = Date.now() / 1000.0;
		
		if(this.state == "stopwatch") {
			this.element.innerText = formatForTimer(now - this.setPoint, "stopwatch");
		} else {
			this.element.innerText = formatForTimer(this.setPoint - now, "countdown");
		}
		
		if(this.active) {
			/* Update us on the next animation frame */
			window.requestAnimationFrame(() => this.updateView());
		}
	}

	remoteArm() {
		this.active = true;
		/* If the set point passed while we were disabled, we need to enter stopwatch state. */
		this.fixState();
	}

	remoteDisarm() {
		this.active = false;
		this.fixState();
	}

	updateState(newState) {
		this.state = newState;
		this.subscribers.forEach((s) => s(newState));
	}

	subscribe(cb) {
		cb(this.state);
		this.subscribers.push(cb);
	}

	fixState() {
		let now = Date.now() / 1000.0;

		if(this.timeoutId) {
			window.clearTimeout(this.timeoutId);
			this.timeoutId = null;
		}		
		
		if(now > this.setPoint) {
			this.updateState("stopwatch");
		} else {
			this.updateState("countdown");

			if(this.active) {
				this.timeoutId = window.setTimeout(() => {
					if(this.active) {
						this.updateState("stopwatch");
						this.timeoutId = null;
					}
				}, (this.setPoint - now) * 1000.0);
			}
		}

		this.updateView();
	}
	
	reload() {
		this.active = false;
		reloadSetPoint().then((data) => {
			this.setPoint = data.setPoint;
			this.active = data.active;
			this.fixState();			
		});
	}
};

/* Open the WebSocket before fetching the setpoint so we never miss any updates. */
let timerInitializationPromise = fetch("/api/ws-endpoint/participant").then(rs => rs.json()).then(rs => {
	const ws = new WebSocket(rs.endpoint);

	return new Promise((resolve, reject) => {
		ws.addEventListener("open", _ => resolve(ws));
		ws.addEventListener("error", reject);
	});
}).then((ws) => {
	return timerElementPromise.then(element => {
		return new TimerWidget(element, ws);
	});
});

timerInitializationPromise.catch(e => window.alert(e));

