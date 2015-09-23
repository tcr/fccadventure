var fs = require('fs');
var crypto = require('crypto');
var sp = require('serialport');

var argv = require('minimist')(process.argv.slice(2));

if (!argv.mode || !argv.hz || !argv.rate || !argv.channel) {
  console.error('Usage: node fcc.js');
  console.error('    node fcc.js --mode=B --hz=20 --rate=11 --channel=11');
  console.error('    node fcc.js --mode=G --hz=20 --rate=24 --channel=11');
  console.error('    node fcc.js --mode=N --hz=20 --rate=8 --channel=11');
  console.error('    node fcc.js --mode=N --hz=40 --rate=8 --channel=11');
  process.exit(1)
}

console.log('fcc tester');

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
  getPrompts(new sp.SerialPort(emitter.comName, {
    baudrate: 115200
  }), listener && new sp.SerialPort(listener.comName, {
    baudrate: 115200
  }), function (emitter, listener) {
    console.log('connected...')
    allSteps(emitter, listener);
  });
});

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
  tessel.on('data', function listener (data) {
    if (!docommand && data.toString().match(/^DOCOMMAND/m)) {
      // docommand = true;
      var id = setInterval(function () {
        var c = file.slice(0, 64)
        // console.log('>>', c);
        file = file.slice(64);
        if (file.length == 0) {
          clearInterval(id);
          docommand = true
        }
        tessel.write('printf \'' + c + '\' >> /tmp/serialfile\n');
        process.stdout.write('. ')
      }, 100);
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
    console.log('uploading to', dest, '...');
    upload(tessel, data, dest, function () {
      console.log('checking integrity...');
      scp(tessel, data, dest, next);
    })
  });
}

function settle (tessel, next) {
  console.log('waiting for', tessel.path, 'to boot...');
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
    tessel.write('\n');
  }, 500);
}

function setupEmitter (emitter, listener, next) {
  settle(emitter, function () {
    scp(emitter, fs.readFileSync(__dirname + '/ipk/kmod-rt2x00-lib.ipk'), '/root/kmod-rt2x00-lib.ipk', function () {
      scp(emitter, fs.readFileSync(__dirname + '/ipk/kmod-rt2x00-lib-htonly.ipk'), '/root/kmod-rt2x00-lib-htonly.ipk', function () {
        scp(emitter, fs.readFileSync(__dirname + '/ipk/kmod-rt2x00-lib-ht40only.ipk'), '/root/kmod-rt2x00-lib-ht40only.ipk', function () {
          scp(emitter, fs.readFileSync(__dirname + '/ipk/packetspammer'), '/usr/bin/packetspammer', function () {
            command(emitter, 'chmod +x /usr/bin/packetspammer', function () {
              next(emitter, listener)
            });
          });
        })
      })
    })
  })
}

function setupListener (emitter, listener, next) {
  settle(listener, function () {
    scp(listener, fs.readFileSync(__dirname + '/ipk/packetspammer'), '/usr/bin/packetspammer', function () {
      command(listener, 'chmod +x /usr/bin/packetspammer', function () {
        next(emitter, listener);
      });
    });
  })
}

function monitor (tessel, next) {
  command(tessel, 'ifconfig wlan0 down', function (out) {
    command(tessel, 'iw dev wlan0 interface add mon0 type monitor', function (out) {
      command(tessel, 'ifconfig mon0 up', function (out) {
        next();
      })
    })
  });
}

function reboot (tessel, next) {
  command(tessel, 'reboot', function (out) {
    console.log('rebooting tessel (40s)...');
    setTimeout(function () {
      settle(tessel, next);
    }, 40*1000);
  })
}

function installIpk (emitter, ipk, next) {
  console.log('selecting ipk...');
  command(emitter, 'opkg install ' + ipk, function (out) {
    console.error(out)
    if (out.match(/cannot satisfy/)) {
      console.error('')
      console.error('ERROR: kernel version is too old.')
      console.error('ERROR: inform Jialiya or Tim immediately.')
      process.exit(1)
    }

    reboot(emitter, function () {
      next();
    })
  })
}

function allSteps (emitter, listener) {
  var mode = String(argv.mode).toUpperCase(); //'B';
  var hz = String(argv.hz); // '20';
  var rate = String(argv.rate); // '6'
  var channel = String(argv.channel); // '11';

  if (mode == 'B' || mode == 'G') {
    var IPK = '/root/kmod-rt2x00-lib.ipk';
  } else if (hz == '20') {
    var IPK = '/root/kmod-rt2x00-lib-htonly.ipk';
  } else if (hz == '40') {
    var IPK = '/root/kmod-rt2x00-lib-ht40only.ipk';
  }

  if (mode == 'B' || mode == 'G') {
    var BITRATE = 'iw mon0 set bitrates legacy-2.4 ' + rate;
  } else {
    var BITRATE = 'iw dev mon0 set bitrates ht-mcs-2.4 ' + rate;
  }

  if (parseInt(channel) > 11) {
    var COUNTRY = 'iw reg set JP';
  } else {
    var COUNTRY = 'iw reg set US';
  }

  if (mode == 'B' || mode == 'G') {
    var CHANNEL = 'iw mon0 set channel ' + channel;
  } else {
    var CHANNEL = 'iw mon0 set channel ' + (parseInt(channel) - 4) + ' "HT40+"';
  }

  console.log('')
  console.log('')
  console.log('ipk:     ', IPK)
  console.log('bitrate: ', BITRATE)
  console.log('country: ', COUNTRY)
  console.log('channel: ', CHANNEL)
  console.log('')
  console.log('')

  setupEmitter(emitter, listener, function () {
    installIpk(emitter, IPK, function () {
      monitor(emitter, function () {
        if (!listener) {
          afterSetup();
        } else {
          setupListener(emitter, listener, function () {
            monitor(listener, afterSetup);
          });
        }
      });
    });
  });

  function afterSetup () {
    command(emitter, COUNTRY + '; ' + CHANNEL + '; ' + BITRATE, function () {
      if (!listener) {
        execute();
      } else {
        command(listener, COUNTRY + '; ' + CHANNEL, function () {
          execute();
        });
      }
    })
  }

  function execute () {
    // Transmit
    emitter.on('data', transmitDump)
    function transmitDump (out) {
      process.stdout.write(out.toString().replace(/^/mg, 'TRANSMIT: '));
    }
    command(emitter, 'packetspammer -d400000 mon0', function () {
      console.error('!!!!! why did transmitter stop?');
    })

    // Receiver
    if (listener) {
      listener.on('data', receiveDump)
      function receiveDump (out) {
        process.stdout.write(out.toString().replace(/^/mg, 'receiver: '));
      }
      command(listener, "tcpdump -y ieee802_11_radio -i mon0 -vvv 'ether host 13:22:33:44:55:66'", function () {
        console.error('!!!!! why did receiver stop?');
      })
    }
  }
}

function terminate (emitter, listener) {
  console.log('all done.');
  emitter.close();
  listener && listener.close();
}

