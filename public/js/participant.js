"use strict";

window.addEventListener("load", function () {
  var e_timer = document.getElementById("timer");
  var e_yourtime = document.getElementById("yourtime");
  var btn_done = document.getElementById("timer-done");
  var btn_submit = document.getElementById("leaderboard-submit");
  var btn_cancel = document.getElementById("leaderboard-cancel");
  var i_duration = document.getElementById("duration");
  var i_name = document.getElementById("i-name");
  var w_name = document.getElementById("name-warning");
  var form = document.getElementById("timer-form");
  window.fitText(e_timer, 0.6);
  window.fitText(e_yourtime, 0.6);
  timerInitializationPromise.then(function (timer) {
    var hasTimeCaptured = false;

    function updateNameWarning() {
      if (hasTimeCaptured && i_name.value == "") {
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
      var now = Date.now() / 1000.0;
      var duration = now - timer.setPoint;
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

    timer.subscribe(function (state) {
      if (state == "stopwatch") {
        btn_done.disabled = hasTimeCaptured;
      } else {
        btn_done.disabled = true;
      }
    });
    btn_done.addEventListener("click", function () {
      captureTime();
    });
    btn_cancel.addEventListener("click", function () {
      uncaptureTime();
    });
    btn_submit.addEventListener("click", function () {
      if (hasTimeCaptured && i_name.value != "") {
        form.submit();
        uncaptureTime();
      }
    });
  });
});