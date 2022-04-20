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

var Synchronizer = /*#__PURE__*/function () {
  function Synchronizer() {
    var _this = this;

    _classCallCheck(this, Synchronizer);

    this.samples = [];
    this.maxSamples = 10;
    this.sample();
    window.setInterval(function () {
      return _this.sample();
    }, 10000);
  }

  _createClass(Synchronizer, [{
    key: "estimateOffsetMillis",
    value: function estimateOffsetMillis() {
      return this.samples.reduce(function (a, b) {
        return a + b;
      }, 0) / this.samples.length; // use this if the synchronizer isn't working right to just null it out
      //return Date.now() - performance.now();
    }
  }, {
    key: "sample",
    value: function sample() {
      var _this2 = this;

      var send = performance.now();
      this.samplerPromise = fetch("/api/synchronizer").then(function (rs) {
        return rs.json();
      }).then(function (rs) {
        var recv = performance.now(); // 3 seconds is a pretty long RTT... something is fishy, discard the sample and retry.

        if (recv - send > 3000) {
          return _this2.sample();
        } else {
          var midpoint = (send + recv) / 2.0;

          _this2.samples.push(rs.time - midpoint);

          if (_this2.samples.length > _this2.maxSamples) {
            _this2.samples.shift();
          }
        }
      });
      return this.samplerPromise;
    }
  }]);

  return Synchronizer;
}();

;

var TimerWidget = /*#__PURE__*/function () {
  /* Valid states:
       - "reset"
       - "countdown"
       - "stopwatch"
  */
  function TimerWidget(element, ws, sync) {
    var _this3 = this;

    _classCallCheck(this, TimerWidget);

    this.element = element;
    this.ws = ws;
    this.sync = sync;
    this.state = "reset";
    this.active = false;
    this.setPoint = null;
    this.subscribers = [];
    /* Subscribe to remote control commands */

    this.ws.addEventListener("message", function (msg) {
      if (msg.data == "set") {
        _this3.reload()["catch"](function (e) {
          return window.alert(e);
        });
      } else if (msg.data == "begin") {
        _this3.remoteArm();
      } else if (msg.data == "cancel") {
        _this3.remoteDisarm();
      } else {
        window.alert("unknown command from server: " + msg.data);
      }
    });
    this.reload();
  }

  _createClass(TimerWidget, [{
    key: "updateView",
    value: function updateView() {
      var _this4 = this;

      var now = (performance.now() + this.sync.estimateOffsetMillis()) / 1000.0;

      if (this.state == "stopwatch") {
        this.element.innerText = formatForTimer(now - this.setPoint, "stopwatch");
      } else {
        this.element.innerText = formatForTimer(this.setPoint - now, "countdown");
      }

      if (this.active) {
        /* Update us on the next animation frame */
        window.requestAnimationFrame(function () {
          return _this4.updateView();
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
      var _this5 = this;

      var now = (performance.now() + this.sync.estimateOffsetMillis()) / 1000.0;

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
            if (_this5.active) {
              _this5.updateState("stopwatch");

              _this5.timeoutId = null;
            }
          }, (this.setPoint - now) * 1000.0);
        }
      }

      this.updateView();
    }
  }, {
    key: "reload",
    value: function reload() {
      var _this6 = this;

      this.active = false;
      reloadSetPoint().then(function (data) {
        _this6.setPoint = data.setPoint;
        _this6.active = data.active;

        _this6.fixState();
      });
    }
  }]);

  return TimerWidget;
}();

;
var sync = new Synchronizer();
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
}, function (err) {
  window.alert("failed to determine participant websocket endpoint: " + err);
}).then(function (ws) {
  return timerElementPromise.then(function (element) {
    return new TimerWidget(element, ws, sync);
  });
}, function (err) {
  window.alert("failed to connect to participant websocket endpoint: " + err);
});