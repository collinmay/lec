window.addEventListener("load", _ => {
	const board_body = document.getElementById("board-body");

	function rebuildTable() {
		fetch("/api/leaderboard").then(rs => rs.json()).then(rs => {
			board_body.replaceChildren(...rs.map(item => {
				let tr = document.createElement("tr");
				let td_name = document.createElement("td");
				let td_duration = document.createElement("td");

				td_name.className = "fw-bold";
				td_name.innerText = item.name;
				
				td_duration.className = "fw-bolder";
				td_duration.innerText = formatForTimer(item.duration, "score");

				tr.appendChild(td_name);
				tr.appendChild(td_duration);

				return tr;
			}));
		});
	};

	rebuildTable();
	
	fetch("/api/ws-endpoint/leaderboard").then(rs => rs.json()).then(rs => {
		console.log("determined leaderboard websocket endpoint to be '%s'", rs.endpoint);

		const ws = new WebSocket(rs.endpoint);

		ws.addEventListener("message", e => {
			if(e.data == "update") {
				rebuildTable();
			} else {
				alert("unknown leaderboard message: " + e.data);
			}
		});

		ws.addEventListener("error", e => window.alert(e.type));
	}).catch(alert);
});
