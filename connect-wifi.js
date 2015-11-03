var fs = require('fs');
var fcc = require('./lib')
var minimist = require('minimist');

function allSteps (emitter, listener) {
  var ssid = argv.name;
  var password = argv.password;
  var tx = argv.txpower;

  // Transmit
  emitter.on('data', function (data) {
    process.stderr.write(data);
  })

  fcc.settle(emitter, function () {
    fcc.command(emitter, [
      ['uci', 'set', 'wireless.@wifi-iface[0].ssid=' + ssid].join(' '),
      !password ? '' : ['uci', 'set', 'wireless.@wifi-iface[0].key=' + password].join(' '),
      ['uci', 'set', 'wireless.@wifi-device[0].disabled=0'].join(' '),
      ['uci', 'set', 'wireless.@wifi-device[0].txpower=' + tx].join(' '),
      ['uci', 'commit', 'wireless'].join(' '),
      'wifi',
    ].join('; '), function () {
      console.log('done.')
      process.exit(0);
    });
  });
}

var argv = minimist(process.argv.slice(2));

if (!argv.name || !argv.txpower) {
  console.error('Usage: sudo node connect-wifi.js');
  console.error('    sudo node connect-wifi.js --name="SSID" --password="PASSWORD" --txpower=20');
  console.error('    sudo node connect-wifi.js --name="SSID" --txpower=20');
  process.exit(1)
}

console.log('connect to wifi');

fcc.launch(allSteps);
