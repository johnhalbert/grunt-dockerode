# grunt-dockerode

> Grunt plugin providing dockerode support.

## Getting Started
This plugin requires Grunt `~0.4.5` and NodeJS `>= 6.12.0`.

If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out the [Getting Started](http://gruntjs.com/getting-started) guide, as it explains how to create a [Gruntfile](http://gruntjs.com/sample-gruntfile) as well as install and use Grunt plugins. Once you're familiar with that process, you may install this plugin with this command:

```shell
npm install grunt-dockerode --save-dev
```

Once the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

```js
grunt.loadNpmTasks('grunt-dockerode');
```

## The "dockerode" task

### Overview
In your project's Gruntfile, add a section named `dockerode` to the data object passed into `grunt.initConfig()`.

```js
grunt.initConfig({
  dockerode: {
    command: '', // Docker command
    options: {
      // Configures connection to Docker
    },
    opts: {
      // Passed in request to Docker
    }
  },
});
```

### Options & opts

Options are used to specify how to connect to the docker daemon/server, opts are passed to the docker daemon/server when making a request. See [dockerode](https://www.npmjs.com/package/dockerode) documentation for more information on what options can be passed.

Task and target specific options don't mix well.  Generally prefer to use one over the other, else results may not be what you expected.

Opts and their possible combinations can be found for a given command in the [Docker API documentation](https://docs.docker.com/engine/api/version-history/).

### Command-specific options

Some commands have options specified outside the opts object.  Generally these originate from `dockerode` itself, and represent arguments not passed to Docker but used to change the behavior of `dockerode` when interacting with Docker.  For this reason they exist at the same level as `opts` and `options` in the task's configuration.  For more information on the origin properties that exist outside options and opts, you can refer to [dockerode source](https://github.com/apocas/dockerode) for a specific command you are running.

Command examples below will contain all additional configuration properties that can exist outside the opts and options configuration.

### Usage Examples - run

```js
{
  command: 'run',                                  // Docker command
  image: 'docker/whalesay',                        // Image to run
  cmd: [ 'cowsay', 'grunt-dockerode is awesome!' ] // Passed to Docker
}
```

### Usage Examples - pull

```js
{
  command: 'pull',
  repoTag: 'docker/whalesay' // Repo to pull from 
}
```

### Usage Examples - push

```js
{
  command: 'push',
  name: 'repo/image:tag' // Where to push
  opts: {
    tag: 'tag',
    // To have dockerode base64 encode your auth information
    authconfig: {
      username: '',
      password: '',
      auth: '',
      email: '',
      serveraddress: ''
    },
    // Or if you already have a base64 encoded auth config
    authconfig: {
      key: '<base64 key>' 
    }
  }
}
```

### Usage Examples - build

Building requires a `context` and `src` be provided.  Additional opts can be provided per the Docker API.  `dockerode` looks for a `Dockerfile` at the root of the directory structure provided by the `src` option.  If this is not the case, a custom dockerfile location can be passed to opts, relative to the root of the src directories.

```js
{
  command: 'build',
  context: __dirname,
  src: [ './**' ],
  opts: {
    t: 'tagname',
    dockerfile: 'customfile'
  }
}
```

### Usage Examples - stop 

```js
{
  command: 'stop',
  id: 'container_name_or_id'
}
```

### Usage Examples - start 

```js
{
  command: 'start',
  id: 'container_name_or_id'
}
```

### Usage Examples - kill 

```js
{
  command: 'kill',
  id: 'container_name_or_id'
}
```

### Usage Examples - ps 

The `ps` task allows for more flexibility than the docker cli's ps command.  Most importantly, in addition to being able to have more control over details retrieved about containers, it allows for a custom mapping of information.  Data is displayed in columns, provided by [columnify](https://www.npmjs.com/package/columnify).  

In addition to the normal opts, the `ps` task will take a `cols` object, which provides as keys the columns to display.  Key values can either be `true`, to simply display the value, or a function to perform transformations on the information such as formatting it for display.  Additionally, a `colOpts` object can be passed, which will be provided as the second argument to [columnify](https://www.npmjs.com/package/columnify), providing additional control over the output.

```js
{
  command: 'ps',
  opts: {
    all: true
  },
  cols: {
    Id: true,
    Names: names => names.map(n => n.substr(1)).join(', ')
  }
  colOpts: {
    Id: { maxWidh: 20 },
    Names: { align: 'right' }
  }
}
```

### Usage Examples - rm

```js
{
  command: 'rm',
  id: 'container_name_or_id'
}
```

### Usage Examples - inspect 

```js
{
  command: 'inspect',
  id: 'container_name_or_id'
}
```

### Usage Examples - exec 

Executes command in given container.  Notable here, the command is commonly used as such with the docker cli: `docker exec -it <container> <command>`.  To reproduce this, the opts in the example configuration below should be used.

```js
{
  command: 'exec',
  id: 'container_name_or_id',
  opts: {
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    Tty: true,
    Cmd: ['bash']
  }
}
```

### Usage Examples - restart

```js
{
  command: 'restart',
  id: 'container_name_or_id'
}
```

### Usage Examples - logs

`opts` must contain either `stdout` or `stderr` members set to `true`, else there will be nothing to log.

```js
{
  command: 'logs',
  id: 'container_name_or_id',
  opts: {
    follow: true,
    stdout: true,
    stderr: true
  }
}
```

### Usage Examples - tag

```js
{
  command: 'tag', 
  name: 'my_image:latest',
  opts: {
    repo: 'private-repo.tld/my_image',
    tag: 'latest'
  }
}
```

### Usage Examples - tag

Like `run`, except allows running detached containers.

```js
{
  command: 'create-container',
  opts: {
    name: 'my-container',
    Image: 'nginx:latest',
    ExposedPorts: {
      '80/tcp': {}
    },
    HostConfig: {
      PortBindings: {
        '80/tcp': [{
          HostPort: 8080
        }]
      }
    }
  }
}
```

## Release History
- 0.1.1 - Adds `create-container` support.
- 0.1.0 - Initial release
