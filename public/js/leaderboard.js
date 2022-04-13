"use strict";

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

window.addEventListener("load", function (_) {
  var board_body = document.getElementById("board-body");

  function rebuildTable() {
    fetch("/api/leaderboard").then(function (rs) {
      return rs.json();
    }).then(function (rs) {
      board_body.replaceChildren.apply(board_body, _toConsumableArray(rs.map(function (item) {
        var tr = document.createElement("tr");
        var td_name = document.createElement("td");
        var td_duration = document.createElement("td");
        td_name.className = "fw-bold";
        td_name.innerText = item.name;
        td_duration.className = "fw-bolder";
        td_duration.innerText = formatForTimer(item.duration, "score");
        tr.appendChild(td_name);
        tr.appendChild(td_duration);
        return tr;
      })));
    });
  }

  ;
  rebuildTable();
  fetch("/api/ws-endpoint/leaderboard").then(function (rs) {
    return rs.json();
  }).then(function (rs) {
    console.log("determined leaderboard websocket endpoint to be '%s'", rs.endpoint);
    var ws = new WebSocket(rs.endpoint);
    ws.addEventListener("message", function (e) {
      if (e.data == "update") {
        rebuildTable();
      } else {
        alert("unknown leaderboard message: " + e.data);
      }
    });
    ws.addEventListener("error", function (e) {
      return window.alert(e.type);
    });
  })["catch"](alert);
});