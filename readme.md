# sd-card-copy

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