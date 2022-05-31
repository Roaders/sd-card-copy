# sd-card-copy

## Server Configuration

The server can be configured with a `.env` file and a json config file. In most cases the default `.env` file can be used and most config can be done in the json file.

### .env

```
port=3000
configPath=config.json
logPath=logs/log.txt
logType=both
clusterLimit=4
```
paths are all relative to the `.env` file which should located in the `data` folder.

**port**

Defaults to `3000`

**configPath**

Defaults to `config.json`

**logPath**

Defaults to `logs/log.txt`. Logs are rotated daily.

**logType**

Can be `file`. `console` or `both`. Defaults to `both`

**clusterLimit**

If you want to allow node clustering set a limit for the number of workers. If `clusterLimit` is not set or is less than 2 clustering will not be used.

### Config

By default a json config file is loaded from `data/config.json`. This can also be a `js` file.

```js
module.exports = {
    targetPath: "C:/video/{DATE yyyy}/{DATE MMM}",
    strategies: [(token) => (token === 'MY_TOKEN' ? 'REPLACED_CONTENT' : undefined)],
}
```

**targetPath**

Optional. If set provides the default target path when copying so that it does not have to be specified for each request. The following tokens can be included:

  * `{TIMESTAMP}` - replaced with milliseconds since epoch
  * `{DATE}` - will be replaced with the default javascript `toDateString()` formatted date.
  * `{DATE yyyy_MM_dd}` / `{DATE "EEE do MMM yyyy"}` Formatted date using [date-fns formatting tokens](https://date-fns.org/v2.28.0/docs/format).

**strategies**
Custom path replacement strategies can be included in your config. The strategy must be a `TokenReplacementStrategy`:

[//]: # (ts-command-line-args_write-markdown_insertCodeBelow file="sd-card-copy-server/src/contracts.ts" codeComment="typescript" )
```typescript
export type TokenReplacementStrategy = (
    tokenName: string, // Given {DATE} will be DATE
    tokenArgs: string[] | undefined, // Given {DATE someFormat, someOtherArg} will be ['someFormat', 'someOtherArg']
    token: string, // Given {DATE} will be {DATE}
    targetPath: string, // entire target path e.g. C:/fileSump/{TOKEN_ONE}/{TOKEN_TWO}
    sourcePath: string // source folder we are copying from
) => string | Promise<string | undefined> | undefined; // if token cannot be handled by strategy return undefined
```
[//]: # (ts-command-line-args_write-markdown_insertCodeAbove)
example strategies can be seen at `sd-card-copy-server\src\strategies`

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

[//]: # (ts-command-line-args_write-markdown_insertCodeBelow file="examples/usbMountHook.js" codeComment="js" )
```js
#!/usr/bin/env node

const http = require('http');

async function makeRequest() {
    await http.get(`http://localhost:3000/copy-path?source-path=${process.env.UM_MOUNTPOINT}`);
}

makeRequest();

```
[//]: # (ts-command-line-args_write-markdown_insertCodeAbove)
Make the file executable:
```bash
sudo chmod +x /etc/usbmount/makeStartCopyRequest
```

## Docker

the command that you need to run will depend on your setup and specifically what you want to copy to where. I use this command:

```bash
$ docker run -it -p 3000:3000 -v /someLocalStorage/data:/usr/src/app/data -v /mnt:/mnt --mount type=bind,source=/media,target=/media,bind-propagation=shared --name sd-card-copy roaders/sd-card-copy:latest
```

#### -it 
attach a terminal session so we can see what is going on
#### -p 3000:3000
connect local port 3000 to the exposed internal port 3000
#### -v /someLocalStorage/data:/usr/src/app/data
map a folder to the data folder used in the container so we can configure the instance and store logs
#### -v /mnt:/mnt
map the `mnt` folder into the container. This allows me to copy to `/mnt/someFolder`. YOu will need to map and folder you want to copy to.
#### --mount type=bind,source=/media,target=/media,bind-propagation=shared
this maps the `media` folder to `media` within the container. This will also map newly mounted usb drives as well
#### --name sd-card-copy
name of the container
#### roaders/sd-card-copy:latest
the image to base the container on

### Upgrade:

```bash
$ docker pull roaders/sd-card-copy:latest
$ docker stop sd-card-copy
$ docker rm sd-card-copy
$ docker run -it --name sd-card-copy -p 3000:3000 -v /someLocalStorage/data:/usr/src/app/data -v /mnt:/mnt --mount type=bind,source=/media,target=/media,bind-propagation=shared roaders/sd-card-copy:latest
```