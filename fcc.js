var fcc = require('./lib')
var minimist = require('minimist');

function monitor (tessel, next) {
  fcc.command(tessel, 'ifconfig wlan0 down', function (out) {
    fcc.command(tessel, 'iw dev wlan0 interface add mon0 type monitor', function (out) {
      fcc.command(tessel, 'ifconfig mon0 up', function (out) {
        next();
      })
    })
  });
}

function allSteps (emitter, listener) {
  var mode = String(argv.mode).toUpperCase(); //'B';
  var hz = String(argv.hz); // '20';
  var rate = String(argv.rate); // '6'
  var channel = String(argv.channel); // '11';

  if (mode == 'B' || mode == 'G') {
    var IPK = 'rm -f /FCC_HT; rm -f /FCC_40'; // /root/kmod-rt2x00-lib.ipk';
  } else if (hz == '20') {
    var IPK = 'touch /FCC_HT; rm -f /FCC_40'; //'/root/kmod-rt2x00-lib-htonly.ipk';
  } else if (hz == '40') {
    var IPK = 'touch /FCC_HT; touch /FCC_40'; // '/root/kmod-rt2x00-lib-ht40only.ipk';
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

  fcc.settle(emitter, function () {
    monitor(emitter, function () {
      if (listener) {
        fcc.settle(listener, function () {
          monitor(listener, function () {
            afterSetup();
          });
        });
      } else {
        afterSetup();
      }
    });
  });

  function afterSetup () {
    fcc.command(emitter, COUNTRY + '; ' + CHANNEL + '; ' + BITRATE + '; ' + IPK, function () {
      if (!listener) {
        execute();
      } else {
        fcc.command(listener, COUNTRY + '; ' + CHANNEL, function () {
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
    fcc.command(emitter, 'packetspammer -d400000 mon0', function () {
      console.error('!!!!! why did transmitter stop?');
    })

    // Receiver
    if (listener) {
      listener.on('data', receiveDump)
      function receiveDump (out) {
        process.stdout.write(out.toString().replace(/^/mg, 'receiver: '));
      }
      fcc.command(listener, "tcpdump -y ieee802_11_radio -i mon0 -vvv 'ether host 13:22:33:44:55:66'", function () {
        console.error('!!!!! why did receiver stop?');
      })
    }
  }
}

var argv = minimist(process.argv.slice(2));

if (!argv.mode || !argv.hz || !argv.rate || !argv.channel) {
  console.error('Usage: node fcc.js');
  console.error('    node fcc.js --mode=B --hz=20 --rate=11 --channel=11');
  console.error('    node fcc.js --mode=G --hz=20 --rate=24 --channel=11');
  console.error('    node fcc.js --mode=N --hz=20 --rate=8 --channel=11');
  console.error('    node fcc.js --mode=N --hz=40 --rate=8 --channel=11');
  process.exit(1)
}

console.log('fcc tester');

fcc.launch(allSteps);
