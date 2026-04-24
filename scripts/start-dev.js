const { spawn } = require('child_process');

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function start(name, args) {
  const child = spawn(npmCmd, args, {
    stdio: 'inherit',
    shell: false,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`[${name}] exited with signal ${signal}`);
    } else {
      console.log(`[${name}] exited with code ${code}`);
    }
    if (!shuttingDown) {
      shutdown(code ?? 0);
    }
  });

  return child;
}

let shuttingDown = false;
const backend = start('backend', ['run', 'dev']);
const worker = start('worker', ['run', 'worker']);

function shutdown(exitCode = 0) {
  shuttingDown = true;
  backend.kill();
  worker.kill();
  process.exit(exitCode);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
