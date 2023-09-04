import { exec } from 'child_process';
import { promisify } from 'util';

export class ExecService {
  #exec = promisify(exec);

  run(command, timeout = 10000) {
    return this.#exec(command, { timeout });
  }
}
