# sd-card-copy

## Server Configuration

The server can be configured with a `.env` file and a json config file. In most cases the default `.env` file can be used and most config can be done in the json file.

### .env

```
port=3000
configPath=data/config.json
logPath=data/logs/log.txt
logType=both
```

**port**

Defaults to `3000`

**configPath**

Defaults to `data/config.json`

**logPath**

Defaults to `data/logs/log.txt`. Logs are rotated daily.

**logType**

Can be `file`. `console` or `both`. Defaults to `both`

### JSON Config

By default a json config file is loaded from `data/config.json`.

```json
{
    "targetPath": "C:/video"
}
```

**targetPath**

Optional. If set provides the default target path when copying so that it does not have to be specified for each request.


## usbmount

[Usbmount](https://github.com/rbrito/usbmount) is a tool to automatically mount any usb drive that's inserted. I had some issues getting it to work on my raspberry pi though so I'll record the steps here (mostly so that when I forget in a months time I've documented it!).

**Clone the repo**

```bash
git clone https://github.com/rbrito/usbmount.git
cd usbmount
```

**Install Dependencies**

```bash
sudo apt-get update && sudo apt-get install -y debhelper build-essential
```

**Build**

```bash
cd usbmount
sudo dpkg-buildpackage -us -uc -b
```

**Install**

```bash
cd ..
sudo apt-get install -f ./usbmount_0.0.24_all.deb 
sudo reboot now

```

**Support exfat SD cards**

```bash
sudo apt-get install exfat-fuse exfat-utils
sudo nano /etc/usbmount/usbmount.conf
```
Add `exfat` to the `FILESYSTEMS` list

**Logs**

```bash
journalctl -u 'usbmount*' -f
```

**Start Copy**

`usbmount` can kick off a copy operation by making a request to our server when a drive is inserted:

```bash
sudo nano /etc/usbmount/makeStartCopyRequest
```

Copy the following:

```js
#!/usr/bin/env node

const http = require('http');

async function makeRequest(){
    // you may need to update your port depending on how you have configured your server
    await http.get(`http://localhost:3000/copy-path?source-path=${process.env.UM_MOUNTPOINT}`);

    console.log(`Request done`);
}

makeRequest();
```
Make the file executable:
```bash
sudo chmod +x /etc/usbmount/makeStartCopyRequest
```