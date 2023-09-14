import { exec } from 'child_process';
import { promisify } from 'util';

export class ExecService {
  #exec = promisify(exec);

  async run(command, timeout = 10000, retry = 3) {
    console.log(command);
    do {
      try {
        const result = await this.#exec(command, {
          timeout,
          maxBuffer: 1024 * 1024 * 50,
        });

        return result;
      } catch (error) {
        if (error?.stderr === '') {
          return { stdout: '', stderr: '' };
        }

        console.log('retrying', retry);
        retry--;
        if (retry === 0) {
          throw error;
        }
      }
    } while (true);
  }
}
