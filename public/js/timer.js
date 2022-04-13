"use strict";

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }

/* yeah this is kinda shitty but it's javascript soooo... */
function reloadSetPoint() {
  return fetch("/api/countdown").then(function (rs) {
    return rs.json();
  }).then(function (rs) {
    return {
      setPoint: rs.set_point,
      active: rs.active
    };
  });
}

;
var timerElementPromise = new Promise(function (resolve, reject) {
  window.addEventListener("load", function (_) {
    resolve(document.getElementById("timer"));
  });
});

function formatForTimer(seconds, type) {
  if (type == "countdown") {
    return Math.floor(seconds).toString();
  } else if (type == "stopwatch") {
    var str = "";
    str += Math.floor(seconds / 60).toString().padStart(2, "0");
    str += ":";
    str += Math.floor(seconds % 60).toString().padStart(2, "0");
    str += ".";
    str += Math.floor(seconds * 1000.0 % 1000.0).toString().padStart(3, "0");
    return str;
  } else if (type == "score") {
    var _str = "";
    _str += Math.floor(seconds / 60).toString();
    _str += ":";
    _str += Math.floor(seconds % 60).toString().padStart(2, "0");
    return _str;
  }
}

var TimerWidget = /*#__PURE__*/function () {
  /* Valid states:
       - "reset"
       - "countdown"
       - "stopwatch"
  */
  function TimerWidget(element, ws) {
    var _this = this;

    _classCallCheck(this, TimerWidget);

    this.element = element;
    this.ws = ws;
    this.state = "reset";
    this.active = false;
    this.setPoint = null;
    this.subscribers = [];
    /* Subscribe to remote control commands */

    this.ws.addEventListener("message", function (msg) {
      if (msg.data == "set") {
        _this.reload()["catch"](function (e) {
          return window.alert(e);
        });
      } else if (msg.data == "begin") {
        _this.remoteArm();
      } else if (msg.data == "cancel") {
        _this.remoteDisarm();
      } else {
        window.alert("unknown command from server: " + msg.data);
      }
    });
    this.reload();
  }

  _createClass(TimerWidget, [{
    key: "updateView",
    value: function updateView() {
      var _this2 = this;

      var now = Date.now() / 1000.0;

      if (this.state == "stopwatch") {
        this.element.innerText = formatForTimer(now - this.setPoint, "stopwatch");
      } else {
        this.element.innerText = formatForTimer(this.setPoint - now, "countdown");
      }

      if (this.active) {
        /* Update us on the next animation frame */
        window.requestAnimationFrame(function () {
          return _this2.updateView();
        });
      }
    }
  }, {
    key: "remoteArm",
    value: function remoteArm() {
      this.active = true;
      /* If the set point passed while we were disabled, we need to enter stopwatch state. */

      this.fixState();
    }
  }, {
    key: "remoteDisarm",
    value: function remoteDisarm() {
      this.active = false;
      this.fixState();
    }
  }, {
    key: "updateState",
    value: function updateState(newState) {
      this.state = newState;
      this.subscribers.forEach(function (s) {
        return s(newState);
      });
    }
  }, {
    key: "subscribe",
    value: function subscribe(cb) {
      cb(this.state);
      this.subscribers.push(cb);
    }
  }, {
    key: "fixState",
    value: function fixState() {
      var _this3 = this;

      var now = Date.now() / 1000.0;

      if (this.timeoutId) {
        window.clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }

      if (now > this.setPoint) {
        this.updateState("stopwatch");
      } else {
        this.updateState("countdown");

        if (this.active) {
          this.timeoutId = window.setTimeout(function () {
            if (_this3.active) {
              _this3.updateState("stopwatch");

              _this3.timeoutId = null;
            }
          }, (this.setPoint - now) * 1000.0);
        }
      }

      this.updateView();
    }
  }, {
    key: "reload",
    value: function reload() {
      var _this4 = this;

      this.active = false;
      reloadSetPoint().then(function (data) {
        _this4.setPoint = data.setPoint;
        _this4.active = data.active;

        _this4.fixState();
      });
    }
  }]);

  return TimerWidget;
}();

;
/* Open the WebSocket before fetching the setpoint so we never miss any updates. */

var timerInitializationPromise = fetch("/api/ws-endpoint/participant").then(function (rs) {
  return rs.json();
}).then(function (rs) {
  var ws = new WebSocket(rs.endpoint);
  return new Promise(function (resolve, reject) {
    ws.addEventListener("open", function (_) {
      return resolve(ws);
    });
    ws.addEventListener("error", reject);
  });
}).then(function (ws) {
  return timerElementPromise.then(function (element) {
    return new TimerWidget(element, ws);
  });
});
timerInitializationPromise["catch"](function (e) {
  return window.alert(e);
});