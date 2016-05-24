+function(){
"use strict";
var rows = [
  ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'],
  ['Esc', '', '', 'reload', 'cut', 'copy', 'paste', 'undo', 'redo', '', '', 'r.click'],
  ['back', '?', '{', '}', '[', ']', '/', '\\', '|', '<', '>', 'm.click'],
  ['forward', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', 'click'],
  ['`', '=', ':', '"', '_', '+', 'FwdDel', '', 'Home', 'End', 'PgUp', 'PgDn'],
  ['Tab', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', 'Delete'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'Enter'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', '\''],
  ['Shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/', 'Up', 'Shift'],
  ['Ctrl', 'Alt', 'space', 'Left', 'Down', 'Right']
  ];

// keyname: true for keys that are currently pressed down
var activatedKeys = Object.create(null);

var cachebuster = function() {
  return '' + Date.now() + Math.random();
}

var $statusarea = document.createElement('div');
$statusarea.className = 'statusarea';

// TODO if queued things are too old, stop trying them
// TODO server-side, unpress keys when connection issues
// TODO: per queue-item padding to equal size, and random dummy packets?
var queue = [];
var inflight_queue = null;

var logStr = 'begin';
$statusarea.textContent = logStr;
var doLog = function(s) {
  logStr += '; ' + s;
  logStr = logStr.slice(-100);
  $statusarea.textContent = logStr;
};

// For sending data over the wire and making it a bit harder for
// eavesdroppers to guess what you sent, make the messages only
// have a few possible size categories they can be.
//
// This does not protect from timing attacks.
// For extracting small timing differences from this code,
// I imagine I can't stop Chrome's touch processing having
// small timing differences too. As an unreliable mitigation,
// an attacker won't know what exact instant you pressed a key,
// and their sample size of your typing is bounded by the amount
// you actually type.
//
// For larger timing differences -- say, 1-100ms -- it is
// very likely the user will have patterns of different
// delay between different letters.  These will help
// reveal what they type.  How can we mitigate this,
// and at what cost?
//
// Consider
//   https://security.stackexchange.com/questions/47192/how-does-ssh-defend-against-keystroke-timing-attacks
// and the article "Timing analysis of keystrokes and timing attacks on SSH".
//
// The stackexchange page says this is not publicly known to have
// been a problem in practice. However, there could be non-public
// attacks, and we could be more at risk than SSH: SSH only sends
// keydown, while we send both keydown and keyup, so we leak more info.
//
// The article's only suggestion that it feels good about is
// to send a message every 50ms, whether or not there is a new
// event to send.  (This could stop after a few seconds of
// inactivity, with random length of "few", without leaking
// too much.)  I'm unclear how reliably JS can do something
// at that frequency, and how bad the latency tradeoff is.
var jsonStringifyWithPadding = function(obj, padCoarseness) {
  var out = JSON.stringify(obj);
  var padding = ((padCoarseness - 1) - (out.length % padCoarseness));
  return out + ' '.repeat(padding);
};


var retrySendQueue = function() {
  setTimeout(function() {
    queue = [].concat(inflight_queue, queue);
    inflight_queue = null;
    trySendQueue();
  }, 1250);
};
var trySendQueue = function() {
  if(queue.length === 0) {
    return;
  }
  if(inflight_queue) {
    return;
  }
  var startTime = Date.now();
  var req = new XMLHttpRequest();
  req.onreadystatechange = function() {
    if(req.readyState === 4) { // complete
      if(req.status === 200 || req.status === 204) {
        console.log("yay");
        inflight_queue = null;
        var endTime = Date.now();
        doLog('done ' + (endTime - startTime) + 'ms.');
        trySendQueue();
      } else {
        console.log("boo!", req.status);
        doLog('failed.');
      }
    }
  };
  req.error = function() {
    doLog('err-retry.');
    retrySendQueue();
  };
  req.open('POST', '/magic?'+cachebuster(), true);
  req.timeout = 6000; // in IE11, .timeout must be set after .open
  req.ontimeout = function() {
    doLog('timeout-retry.');
    retrySendQueue();
  };
  req.setRequestHeader('X-Not-Cross-Domain', 'yes');
  //req.setRequestHeader('X-Token', localStorage["authtoken"]);
  //req.setRequestHeader('X-Command', command);
  req.setRequestHeader('Content-Type', 'application/json');
  var body = {"InputEvents": queue};
  inflight_queue = queue;
  queue = [];
  req.send(jsonStringifyWithPadding(body, 120));
};

// IE11 doesn't support 2 argument classList.toggle
// https://developer.mozilla.org/en-US/docs/Web/API/Element/classList
var toggleClass = function(elem, klass, be) {
  elem.classList[be ? 'add' : 'remove'](klass);
};

//..hmm what if keyup gets there before keydown..

// mouseup can be on the wrong element and doesn't work with touch
// simpler: hackily use the transitionend event to detect CSS's
// perfect :active logic!
// ...not quite perfect. Not for multiple touches at once on ChromeOS.
// Also preventDefault on long touches on ChromeOS is important here
// (stop rightclick menu, which is both the goal and sad).
var keyActiveChange = function(keyName, isDown, keyElem, e) {
  var wasDown = !!activatedKeys[keyName];
  var isDown = !!isDown;
  if(isDown) {
    activatedKeys[keyName] = true;
  } else {
    delete activatedKeys[keyName];
  }
  if(isDown !== wasDown) {
    var action = (isDown ? 'keydn' : 'keyup');
    var inputEvent = {"Action": action, "Key": keyName};
    //padJSONObjToMultiple(inputEvent, 40);
    queue.push(inputEvent);
    trySendQueue();
    if(keyElem) {
      toggleClass(keyElem, 'activated', isDown);
    }
    doLog(keyName + " " + (isDown ? "down" : "up"));
  }
};
var transitionEvent = function(e) {
  e.preventDefault();
  e.stopPropagation();
  var keyElem = e.target;
  var down = keyElem.matches(':active');
  var key = keyElem.dataset.action;
  doLog('trans'+down);
  keyActiveChange(key, down, keyElem, e);
};
//TODO events bind to body not a?
var touchEvent = function(e) {
  //if(e.type !== 'touchend')
  e.preventDefault();
  e.stopPropagation();
  var touches = e.changedTouches;
  for(var i = 0; i < touches.length; i++) {
    var touch = touches[i];
    var keyElem = touch.target;
    var key = keyElem.dataset.action;
    if(key) {
    doLog(e.type);
    if(e.type === 'touchstart') {
      keyActiveChange(key, true, keyElem, touch);
    }
    if(e.type === 'touchend' || e.type === 'touchcancel') {
      keyActiveChange(key, false, keyElem, touch);
    }
    }
  }
};
var mouseEvent = function(e) {
  e.preventDefault();
  e.stopPropagation();
  var keyElem = e.target;
  var key = keyElem.dataset.action;
  if(key) {
    doLog(e.type);
    keyActiveChange(key, e.type==='mousedown', keyElem, e);
  }
};
var $kb = document.createElement('div');
$kb.className = 'kb';
$kb.addEventListener('touchstart', touchEvent);
$kb.addEventListener('touchend', touchEvent);
$kb.addEventListener('touchcancel', touchEvent);
$kb.addEventListener('touchmove', touchEvent);
$kb.addEventListener('mousedown', mouseEvent);
$kb.addEventListener('mouseup', mouseEvent);
for(var r = 0; r < rows.length; r++) {
  var row = rows[r];
  var $row = document.createElement('div');
  $row.className = 'row';
  for(var c = 0; c < row.length; c++) {
    var key = row[c];
    var $key = document.createElement('button');
    $key.className = 'key';
    $key.textContent = key;
    $key.dataset.action = key;
    $key.dataset.row = r;
    $key.dataset.col = c;
   // $key.addEventListener('animationstart', transitionEvent);
    $row.appendChild($key);
  }
  $kb.appendChild($row);
}
document.body.appendChild($kb);

$kb.appendChild($statusarea);

var keyEvent = function(e) {
  e.preventDefault();
  e.stopPropagation();
  console.log(e, e.key);
  if(e.key) {
    keyActiveChange(e.key, e.type === 'keydown');
  }
};
document.body.addEventListener('keydown', keyEvent);
document.body.addEventListener('keyup', keyEvent);
document.addEventListener('keydown', keyEvent);
document.addEventListener('keyup', keyEvent);

}();
