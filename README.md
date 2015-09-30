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

Successful output will look like:

```
...
TRANSMIT:
TRANSMIT: RX: Rate:  1.0Mbps, Freq: 2143311.936GHz, Ant: 4571932, Flags: 0x7A61ED
TRANSMIT: 0000: 50 61 63 6B 65 74 73 70 61 6D 6D 65 72 20 31 38  Packetspammer 18
TRANSMIT: 0010: 62 72 6F 61 64 63 61 73 74 20 70 61 63 6B 65 74  broadcast packet
TRANSMIT: 0020: 23 30 30 30 31 35 20 2D 2D 20 3A 2D 44 20 2D 2D  #00015 -- :-D --
TRANSMIT: 0030: 54 65 73 73 65 6C 2D 30 32 41 33 35 32 38 33 37  Tessel-02A352837
TRANSMIT: 0040: 43 44 44 20 2D 2D 2D 2D                          CDD ----
TRANSMIT: TRANSMIT: rtap: 0000: 00 00 0D 00 04 80 02 00 02 00 00 00 00
TRANSMIT:
TRANSMIT: RX: Rate:  1.0Mbps, Freq: 2143311.936GHz, Ant: 4571932, Flags: 0x7A61ED
TRANSMIT: 0000: 50 61 63 6B 65 74 73 70 61 6D 6D 65 72 20 31 38  Packetspammer 18
TRANSMIT: 0010: 62 72 6F 61 64 63 61 73 74 20 70 61 63 6B 65 74  broadcast packet
TRANSMIT: 0020: 23 30 30 30 31 35 20 2D 2D 20 3A 2D 44 20 2D 2D  #00015 -- :-D --
TRANSMIT: 0030: 54 65 73 73 65 6C 2D 30 32 41 33 35 32 38 33 37  Tessel-02A352837
TRANSMIT: 0040: 43 44 44 20 2D 2D 2D 2D                          CDD ----
TRANSMIT: TRANSMIT: rtap: 0000: 00 00 0D 00 04 80 02 00 02 00 00 00 00
...
```

etc.

## logs

All logs are dumped to files `log-commands.txt` and `log-emitter.txt` in this directory. These are used for debugging what may have gone wrong.

## license

MIT/Apache-2.0

(but why?)
