# fcc adventure!

1. `git clone` this repository
2. enter the directory
3. run `npm install`

## install

Plug in your Tessel. Run:

```
sudo node install.js
```

You should see installation go similar to this:

```
$ node /Users/timryan/Desktop/fccadventure/install.js
emitting with /dev/cu.usbmodem1412
listening with /dev/cu.usbmodem1452
starting...
waiting for /dev/cu.usbmodem1412 ...
we are 0 seconds into boot mode, wait up to 30 s...
waiting for /dev/cu.usbmodem1412 ...
we are 29 seconds into boot mode, wait up to 30 s...
waiting for /dev/cu.usbmodem1412 ...
booted!
+ md5sum /root/kmod-rt2x00lib.ipk
/root/kmod-rt2x00lib.ipk is up to date.
+ md5sum /usr/bin/packetspammer
/usr/bin/packetspammer is up to date.
+ chmod +x /usr/bin/packetspammer
selecting ipk...
+ opkg install /root/kmod-rt2x00lib.ipk
Installing kmod-rt2x00-lib (3.18.16+2015-03-09-3) to root...
Configuring kmod-rt2x00-lib.

+ reboot
All set up. Please unplug and plug in the Tessels.
Then run fcc.js
```

Now unplug your Tessel.

## fcc tests

Unplug and plug in your Tessel. Run any of the following commands:

```
Usage: sudo node fcc.js
    sudo node fcc.js --mode=B --hz=20 --rate=11 --channel=11
    sudo node fcc.js --mode=G --hz=20 --rate=24 --channel=11
    sudo node fcc.js --mode=N --hz=20 --rate=8 --channel=11
    sudo node fcc.js --mode=N --hz=40 --rate=8 --channel=11
```

You will not need to reboot or unplug Tessel inbetween commands.

## logs

All logs are dumped to files `log-commands.txt` and `log-emitter.txt` in this directory. These are used for debugging what may have gone wrong.

## license

MIT/Apache-2.0

(but why?)
