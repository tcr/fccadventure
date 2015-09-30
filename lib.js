var fs = require('fs');
var crypto = require('crypto');
var sp = require('serialport');

function launch (next) {
  sp.list(function (err, ports) {
    var tessels = ports.filter(function (port) {
      console.log('checking port', port.comName, '...')
      return port.comName.match(/ttyACM|usbmodem|COM/);
    }).sort(function (a, b) {
      return a.comName < b.comName ? -1 : a.comName > b.comName ? 1 : 0;
    }).map(function (port) {
      console.log('found tessel', port.comName, '...')
      return port;
    });

    console.error('');

    if (tessels.length < 1) {
      console.error('ERR! cannot find any tessels attached to this computer')
      process.exit(1)
    }

    var emitter = tessels.shift();
    console.error('emitting with %s', emitter.comName);

    var listener = tessels.shift();
    if (listener) {
      console.error('listening with %s', listener.comName);
    }

    console.log('starting...')
    var esp = new sp.SerialPort(emitter.comName, {
      baudrate: 115200
    });
    var lsp = listener && new sp.SerialPort(listener.comName, {
      baudrate: 115200
    });

    require('fs').appendFileSync('log-emitter.txt', '\n\n\n\n\n\n' + (new Date()).toString() + '\n' + '$ ' + process.argv.join(' ') + '\n');
    esp.pipe(fs.createWriteStream('log-emitter.txt', {flags: 'a'}))
    next(esp, lsp);
  });
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
        var SIZE = 128;

        var c = file.slice(0, SIZE)
        // console.log('>>', c);
        file = file.slice(SIZE);
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
  output = '';

  var tid = setTimeout(function () {
    console.error('')
    console.error('error: command "' + command + '" took longer than 60s to complete.');
    console.error('this should not happen. please report to Jialiya or Tim this error.');
    process.exit(1);
  }, 60*1000);
  tessel.on('data', function listener (data) {
    if (!docommand && data.toString().match(/^DOCOMMAND/m)) {
      docommand = true;
      tessel.write(command);
      return;
    }
    if (docommand) {
      output += data.toString();
      // console.log(data.toString());
    }
    if (docommand && output.match(/root@.*?:/)) {
      tessel.removeListener('data', listener);
      clearTimeout(tid);
      next(output.replace(/.*?\r\n/, '').replace(/(root@.*?:\S+\s*\r?\n?)*$/, ''))
    }
  })
  tessel.write('\x03\x03echo DOCOMMAND\n')
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
    var until = data.toString().match(/\[\s*(\d+)\.\d+\s*\]/m);
    if (until) {
      allow = parseInt(until[1]);
      var MAXWAIT = 30;
      if (allow < MAXWAIT) {
        console.log('we are %s seconds into boot mode, wait up to %s s...', allow, MAXWAIT)
        tessel.removeListener('data', listener);
        clearInterval(intid);
        setTimeout(function () {
          settle(tessel, next);
        }, (MAXWAIT-allow)*1000);
      }
    }

    buf += data.toString();
    if (buf.match(/(root@(?!\(none\))\S+\s*\r?\n?){10}$/)) {
      console.log('booted!');
      tessel.removeListener('data', listener);
      clearInterval(intid);
      next();
    }
  });

  var COUNTMAX = 5*2;
  var count = 0;
  var intid = setInterval(function () {
    if (count == 32*2) { 
      tessel.write('\x04'); // Ctrl+D in case we are caught
    }

    if (count > COUNTMAX) {
      tessel.write('\n\n\x03');
    } else {
      tessel.write('\n\n');
    }
    count = count + 1;
  }, 500);
}

function terminate (emitter, listener) {
  console.log('all done.');
  emitter.close();
  listener && listener.close();
}

exports.launch = launch;
exports.upload = upload;
exports.command = command;
exports.md5 = md5;
exports.scp = scp;
exports.settle = settle;

(function () {
  require('fs').appendFileSync('log-commands.txt', '\n\n\n\n\n\n' + (new Date()).toString() + '\n' + '$ ' + process.argv.join(' ') + '\n');
  var all = fs.createWriteStream('log-commands.txt', {flags: 'a'});

  var w1 = process.stdout.write;
  process.stdout.write = function () {
    all.write.apply(all, arguments);
    return w1.apply(process.stdout, arguments);
  }

  var w2 = process.stderr.write;
  process.stderr.write = function () {
    all.write.apply(all, arguments);
    return w2.apply(process.stderr, arguments);
  }
})();
