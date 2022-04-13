window.addEventListener("load", () => {
	const e_timer = document.getElementById("timer");
	const e_yourtime = document.getElementById("yourtime");
	const btn_done = document.getElementById("timer-done");
	const btn_submit = document.getElementById("leaderboard-submit");
	const btn_cancel = document.getElementById("leaderboard-cancel");
	const i_duration = document.getElementById("duration");
	const form = document.getElementById("timer-form");
	
	window.fitText(e_timer, 0.6);
	window.fitText(e_yourtime, 0.6);
	
	timerInitializationPromise.then((timer) => {
		let hasTimeCaptured = false;

		function captureTime() {
			let now = Date.now() / 1000.0;
			let duration = now - timer.setPoint;
			
			e_yourtime.innerText = formatForTimer(duration, "score");
			i_duration.value = duration;
			hasTimeCaptured = true;
			btn_done.disabled = true;
			btn_submit.disabled = false;
			btn_cancel.disabled = false;
		}

		function uncaptureTime() {
			e_yourtime.innerText = "xx:xx";
			hasTimeCaptured = false;
			btn_done.disabled = timer.state != "stopwatch";
			btn_submit.disabled = true;
			btn_cancel.disabled = true;			
		}
		
		timer.subscribe((state) => {
			if(state == "stopwatch") {
				btn_done.disabled = hasTimeCaptured;
			} else {
				btn_done.disabled = true;
			}
		});

		btn_done.addEventListener("click", () => {
			captureTime();
		});

		btn_cancel.addEventListener("click", () => {
			uncaptureTime();
		});

		btn_submit.addEventListener("click", () => {
			form.submit();
			uncaptureTime();
		});
	});
});
