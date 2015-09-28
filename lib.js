var fs = require('fs');
var crypto = require('crypto');
var sp = require('serialport');

function launch (next) {
  sp.list(function (err, ports) {
    var tessels = ports.filter(function (port) {
      return port.manufacturer.match(/Technical Machine/)
    }).sort(function (a, b) {
      return a.comName < b.comName ? -1 : a.comName > b.comName ? 1 : 0;
    });

    if (tessels.length < 1) {
      console.error('ERR! cannot find a tessel attached to this computer')
      process.exit(1)
    }

    var emitter = tessels.shift();
    console.error('emitting with %s', emitter.comName);

    var listener = tessels.shift();
    if (listener) {
      console.error('listening with %s', listener.comName);
    }

    console.log('starting...')
    next(new sp.SerialPort(emitter.comName, {
      baudrate: 115200
    }), listener && new sp.SerialPort(listener.comName, {
      baudrate: 115200
    }));
  });
}

function getName (emitter, next) {
  emitter.on('data', function listener (data) {
    if (data.toString().match(/root@.*?:/)) {
      var id = data.toString().match(/root@(.*?):/)[1];
      clearInterval(sid);
      emitter.removeListener('data', listener);
      next(id)
    }
  })
  var sid = setInterval(function () {
    emitter.write('\n');
    setTimeout(function () {
      emitter.write('\x03');
    }, 250);
  }, 500);
}

function upload (tessel, file, dest, next) {
  var docommand = false;
  file = file.toString('base64') + '\n'
  totallen = file.length;
  tessel.on('data', function listener (data) {
    if (!docommand && data.toString().match(/^DOCOMMAND/m)) {
      // docommand = true;
      process.stdout.write('0%')
      var id = setInterval(function () {
        var c = file.slice(0, 64)
        // console.log('>>', c);
        file = file.slice(64);
        if (file.length == 0) {
          clearInterval(id);
          docommand = true
          process.stdout.write('\n')
        }
        tessel.write('printf \'' + c + '\' >> /tmp/serialfile\n');
        process.stdout.write('\r' + Math.floor(((totallen-file.length)/totallen)*100) + '% ')
      }, 50);
      return;
    }
    // if (docommand) {
      // console.log(data.toString());
    // }
    if (docommand && data.toString().match(/root@.*?:/)) {
      tessel.removeListener('data', listener);
      command(tessel, 'cat /tmp/serialfile | python -m base64 -d > ' + dest, next);
    }
  })
  tessel.write('\n\nrm /tmp/serialfile && touch /tmp/serialfile\n\necho DOCOMMAND\n')
}


function command (tessel, command, next) {
  var docommand = false;
  console.log('+', command);
  command += '\n'
  output = [];
  tessel.on('data', function listener (data) {
    if (!docommand && data.toString().match(/^DOCOMMAND/m)) {
      docommand = true;
      tessel.write(command);
      return;
    }
    if (docommand) {
      output.push(data);
      // console.log(data.toString());
    }
    if (docommand && data.toString().match(/root@.*?:/)) {
      tessel.removeListener('data', listener);
      next(Buffer.concat(output).toString().replace(/.*?\r\n/, '').replace(/(root@.*?:\S+\s*\r?\n?)*$/, ''))
    }
  })
  tessel.write('\x03\x03echo DOCOMMAND\n')
}

function getPrompts (emitter, listener, next) {
  getName(emitter, function () {
    !listener ? next(emitter, listener) : getName(listener, function () {
      next(emitter, listener);
    })
  })
}

function md5 (buf) {
  return crypto.createHash('md5').update(buf).digest("hex")
}

function scp (tessel, data, dest, next) {
  command(tessel, 'md5sum ' + dest, function (out) {
    var match = out.split(/\s+/)[0];
    if (match == md5(data)) {
      console.log(dest, 'is up to date.');
      next();
      return;
    }

    // Upload that file.
    console.log('expected:', md5(data))
    console.log('found:', match);
    console.log('uploading to', dest, '...');
    upload(tessel, data, dest, function () {
      console.log('checking integrity...');
      scp(tessel, data, dest, next);
    })
  });
}

function settle (tessel, next) {
  console.log('waiting for', tessel.path, '...');
  var buf = '';
  tessel.on('data', function listener (data) {
    buf += data.toString();
    if (buf.match(/(root@\S+\s*\r?\n?){10}$/)) {
      console.log('booted!');
      tessel.removeListener('data', listener);
      clearInterval(intid);
      next();
    }
  });
  var intid = setInterval(function () {
    tessel.write('\n\x03');
  }, 500);
}

function terminate (emitter, listener) {
  console.log('all done.');
  emitter.close();
  listener && listener.close();
}

exports.launch = launch;
exports.getName = getName;
exports.upload = upload;
exports.command = command;
exports.getPrompts = getPrompts;
exports.md5 = md5;
exports.scp = scp;
exports.settle = settle;

