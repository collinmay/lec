window.addEventListener("load", () => {
	const e_timer = document.getElementById("timer");
	const e_yourtime = document.getElementById("yourtime");
	const btn_done = document.getElementById("timer-done");
	const btn_submit = document.getElementById("leaderboard-submit");
	const btn_cancel = document.getElementById("leaderboard-cancel");
    const i_duration = document.getElementById("duration");
    const i_name = document.getElementById("i-name");
    const w_name = document.getElementById("name-warning");
	const form = document.getElementById("timer-form");
	
	window.fitText(e_timer, 0.6);
	window.fitText(e_yourtime, 0.6);
	
	timerInitializationPromise.then((timer) => {
		let hasTimeCaptured = false;

	    function updateNameWarning() {
		if(hasTimeCaptured && i_name.value == "") {
		    w_name.className = "small text-danger name-warning";
		    btn_submit.disabled = true;
		} else {
		    w_name.className = "small text-danger name-warning invisible";
		    btn_submit.disabled = !hasTimeCaptured;
		}
	    }

	    updateNameWarning();

	    document.addEventListener("input", updateNameWarning);
	    
		function captureTime() {
			let now = Date.now() / 1000.0;
			let duration = now - timer.setPoint;
			
			e_yourtime.innerText = formatForTimer(duration, "score");
			i_duration.value = duration;
			hasTimeCaptured = true;
			btn_done.disabled = true;
		    btn_cancel.disabled = false;
		    updateNameWarning();
		}

		function uncaptureTime() {
			e_yourtime.innerText = "xx:xx";
			hasTimeCaptured = false;
			btn_done.disabled = timer.state != "stopwatch";
		    btn_cancel.disabled = true;
		    updateNameWarning();
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
			if(hasTimeCaptured && i_name.value != "") {
			    form.submit();
			    uncaptureTime();
			}
		});
	});
});
