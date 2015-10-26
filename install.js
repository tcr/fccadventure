var fs = require('fs');
var crypto = require('crypto');
var sp = require('serialport');
var fcc = require('./lib')
var minimist = require('minimist');

function reboot (tessel, wait, next) {
  fcc.command(tessel, 'reboot', function (out) {
    if (wait) {
      console.log('rebooting tessel (40s)...');
      setTimeout(function () {
        fcc.settle(tessel, next);
      }, 40*1000);
    } else {
      next();
    }
  })
}

function installIpk (emitter, ipk, next) {
  console.log('selecting ipk...');
  fcc.command(emitter, 'opkg install ' + ipk, function (out) {
    if (out.match(/Cannot satisfy/i) || out.match(/Not downgrading/i)) {
      console.error('')
      console.error('ERROR: kernel version is incorrect!!!')
      console.error('ERROR: inform Jialiya or Tim immediately!!!')
      console.error('ERROR:', out.replace(/^\s+|\s+$/g, ''));
      process.exit(1)
    } else {
      console.error(out)
    }

    next();
  })
}

function setupEmitter (emitter, listener, next) {
  fcc.settle(emitter, function () {
    fcc.scp(emitter, fs.readFileSync(__dirname + '/ipk/kmod-rt2x00lib.ipk'), '/root/kmod-rt2x00lib.ipk', function () {
      // fcc.scp(emitter, fs.readFileSync(__dirname + '/ipk/kmod-rt2x00-lib-htonly.ipk'), '/root/kmod-rt2x00-lib-htonly.ipk', function () {
        // fcc.scp(emitter, fs.readFileSync(__dirname + '/ipk/kmod-rt2x00-lib-ht40only.ipk'), '/root/kmod-rt2x00-lib-ht40only.ipk', function () {
          fcc.scp(emitter, fs.readFileSync(__dirname + '/ipk/packetspammer'), '/usr/bin/packetspammer', function () {
            fcc.command(emitter, 'chmod +x /usr/bin/packetspammer', function () {
              next(emitter, listener)
            });
          });
        // })
      // })
    })
  })
}

function setupListener (emitter, listener, next) {
  fcc.settle(listener, function () {
    fcc.scp(listener, fs.readFileSync(__dirname + '/ipk/packetspammer'), '/usr/bin/packetspammer', function () {
      fcc.command(listener, 'chmod +x /usr/bin/packetspammer', function () {
        fcc.scp(listener, fs.readFileSync(__dirname + '/ipk/tcpdump.ipk'), '/root/tcpdump.ipk', function () {
          fcc.scp(listener, fs.readFileSync(__dirname + '/ipk/libpcap.ipk'), '/root/libpcap.ipk', function () {
            next(emitter, listener);
          });
        });
      });
    });
  })
}

function dosteps (emitter, listener) {
  var IPK = '/root/kmod-rt2x00lib.ipk';

  setupEmitter(emitter, listener, function () {
    installIpk(emitter, IPK, function () {
      reboot(emitter, false, function () {
        if (!listener) {
          afterSetup();
        } else {
          setupListener(emitter, listener, function () {
            installIpk(listener, '/root/libpcap.ipk', function () {
              installIpk(listener, '/root/tcpdump.ipk', function () {
                reboot(listener, false, function () {
                  afterSetup();
                })
              });
            });
          });
        }
      });
    });
  });

  function afterSetup () {
    console.log('All set up. Please unplug and plug in the Tessels.')
    console.log('Then run fcc.js')
    emitter.close();
    listener && listener.close();
  }
}

fcc.launch(dosteps);
