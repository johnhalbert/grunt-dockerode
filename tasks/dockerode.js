/*
 * grunt-dockerode
 * https://github.com/johnhalbert/grunt-dockerode
 *
 * Copyright (c) 2017 John Halbert
 * Licensed under the MIT license.
 */

'use strict';

const Docker      = require('dockerode'),
      Promise     = require('bluebird'),
      cliSpinners = require('cli-spinners'),
      readline    = require('readline'),
      fs          = require('fs'),
      columnify   = require('columnify'),
      JSONStream  = require('JSONStream');

module.exports = function(grunt) {
  grunt.registerMultiTask('dockerode', 'Grunt plugin providing dockerode support.', function() {
    // Merge task-specific and/or target-specific options with these defaults.
    const options = this.options({
      punctuation: '.',
      separator: ', '
    });

    const src = this.files.reduce((all, files) => {
      const src = files.src.filter(fd => {
        const stats = fs.statSync(fd);
        return !stats.isDirectory();
      });

      return all.concat(src);
    }, []);

    const data = this.data;
    data.src = src;

    let spinnerInterval, spinnerFrame = 0, curTask = '', numLines; 
    const done = this.async();

    if (this.data.command && isDockerCommand(this.data.command)) {
      runDockerCommand(this.data.command, data, options)
        .catch(err => grunt.log.error(err.message));
    }
    else if (!this.data.command)
      throw new Error(`No Docker command supplied!`);
    else 
      throw new Error(`${this.data.command} is not a valid Docker command`);

    /**
     * Returns true/false whether given command is valid docker command
     * supported by plugin
     * @param {String} cmd The command to evaluate
     * @return {Boolean} true = valid command, false = not
     */
    function isDockerCommand(cmd) {
      const commands = [ 'run', 'pull', 'push', 'build', 'stop', 'start', 'kill', 
        'ps', 'rm', 'inspect', 'exec', 'restart', 'logs', 'stats', 'tag',
        'create-container' ];

      return ~commands.indexOf(cmd);
    }

    /**
     * Runs given docker command
     * @param {String} cmd The command to run
     * @param {Object} args The arguments to pass to the dockerode method
     * @param {Object} opts The options to pass to the docker server
     * @return {Promise<Any>} Promise which resolves with variadic type
     */
    function runDockerCommand(cmd, args, opts) {
      const docker = new Docker(opts);

      switch (cmd) {
        case 'run':
          if (!args.stream)
            args.stream = process.stdout;
          return docker.run(args.image, args.cmd, args.stream, args.create_options, args.start_options)
            .then(done);
        case 'pull':
          curTask = `Pulling ${args.repoTag}`;
          return docker.pull(args.repoTag, args.opts)
            .then(handleReadStream);
        case 'push':
          curTask = `Pushing ${args.name}`;
          return docker.getImage(args.name)
            .push(args.opts, undefined, args.auth)
            .then(handleReadStream);  
        case 'tag':
          return docker.getImage(args.name)
            .tag(args.opts)
            .then(() => {
              grunt.log.ok(`Tagging ${args.opts.repo}:${args.opts.tag}: success!`);
              done();
            });
        case 'build':
          curTask = `Building ${args.opts && args.opts.t ? args.opts.t : 'docker image'}`;
          const { context, src } = args;
          return docker.buildImage({ context, src }, args.opts)
            .then(handleReadStream);
        case 'ps':
          return docker.listContainers(args.opts)
            .then(containers => {
              // If cols was passed in task object, map the docker server
              // response to include only selected columns and to run any
              // transformations provided by transform functions
              if (args.cols) {
                containers = containers.map(cntr => {
                  const container = {};
                  for (let col in args.cols) {
                    if (args.cols[col] instanceof Function)
                      container[col] = args.cols[col](cntr[col]);
                    else
                      container[col] = cntr[col];
                  }
                  return container;
                });
              }

              // Logs the output from columnify. colOpts can be passed in
              // the task object to configure columnify output further.
              grunt.log.writeln(columnify(containers, args.colOpts));
              done();
            });
        case 'stop':
        case 'start':
        case 'kill':
        case 'restart':
          return docker.getContainer(args.id)[cmd](args.opts)
            .then(result => {
              grunt.log.ok(result.output || 'Success!');
              done();
            });
        case 'rm':
          // rm is not a function
          return;
        case 'inspect':
          return docker.getContainer(args.id)[cmd](args.opts)
            .then(result => {
              grunt.log.writeln(JSON.stringify(result, null, 2));
              done();
            });
        case 'exec':
          return docker.getContainer(args.id)[cmd](args.opts)
            .then(exec => exec.start({ stdin: args.opts.AttachStdin, ...args.opts }))
            .then(exec => {
              const stream = exec.output;
              stream.on('end', () => done());
              if (args.opts) {
                if (args.opts.AttachStdin) 
                  process.stdin.pipe(stream);
                if (args.opts.AttachStdout || args.opts.AttachStderr) 
                  stream.pipe(process.stdout);
              }
            });
        case 'logs':
          return docker.getContainer(args.id)[cmd](args.opts)
            .then(stream => {
              stream.on('end', () => done());
              stream.pipe(process.stdout);
             });
        case 'stats':
          // There's a lot here and not quite sure that this fits well with
          // grunt paradygm.  Would be better off using other plugins that can
          // just spawn a new process with the docker cli to get these stats
          // than trying to fit them in to some custom implementation...
          // Leaving alone for now, will not document.
          return docker.getContainer(args.id)[cmd](args.opts)
            .then(stream => {
              stream.on('data', data => {
                const dataObj = JSON.parse(data);
                readline.cursorTo(process.stdout, 0);
                readline.moveCursor(process.stdout, 0, -(numLines+1));
                readline.clearScreenDown(process.stdout);
                numLines = Object.keys(dataObj).length;
                grunt.log.writeln(columnify(dataObj));
              });
            });
        case 'create-container':
          return docker.createContainer(args.opts)
            .then(container => container.start())
            .then(done);
      }
    }

    /**
     * Handles reading stream, displaying busy animation and parsing errors
     * @param {ReadStream} stream ReadStream returned from docker modem
     * @return {void}
     */
    function handleReadStream(stream) {
      // Errors can still appear in the response from the docker server even
      // though the response code suggests success. Stream needs to be parsed
      // in order to look for error messages.
      const errorStream = JSONStream.parse('error')
      errorStream.on('data', errMsg => {
        readline.cursorTo(process.stdout, 0);
        process.stdout.write('');
        throw new Error(errMsg);
      });
      stream.pipe(errorStream);
      
      // Shows animation while the stream is being processed
      startCliSpinner();

      // If no error messages have appeared by the time the stream ends
      // we can get rid of the spinner and display a success message.
      stream.on('end', function() {
        clearCliSpinner();
        readline.cursorTo(process.stdout, 0);
        grunt.log.ok(`${curTask}: success!`);
        done();
      });
    }

    /**
     * Sets an interval that updates the busy animation on the consol
     * @return {void}
     */
    function startCliSpinner() {
      // Produces busy animation by resetting the last line of stdout and
      // updating it with new frames from the animation.
      spinnerInterval = setInterval(() => {
        readline.cursorTo(process.stdout, 0);
        process.stdout.write(
          `${curTask}.. ${cliSpinners.bouncingBall.frames[spinnerFrame]}`
        );
        
        // Increments spinner frames
        if (spinnerFrame === cliSpinners.bouncingBall.frames.length-1)
          spinnerFrame = 0;
        else
          spinnerFrame++;
      }, 80);
    }

    /**
     * Wrapper around clearInterval that passes the spinner interval set by
     * startCliSpinner function
     * @return {void}
     */
    function clearCliSpinner() {
      clearInterval(spinnerInterval);
    }
  });
};
