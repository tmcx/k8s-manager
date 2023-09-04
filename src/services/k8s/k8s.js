import { ExecService } from '../exec/exec.js';
import { ConnectionError } from './errors.js';

export class K8SService {
  #connection;
  #execService;

  constructor() {
    this.#execService = new ExecService();
    this.#connection = false;
    this.checkConnection();
  }

  checkConnection() {
    const checking = async () => {
      const cmd =
        'kubectl get nodes -o=jsonpath="{.items[*][\'metadata.name\']}"';
      try {
        const response = await this.#execService.run(cmd, 2000);
        if (response.stderr) {
          this.#connection = false;
        }
        this.#connection = true;
      } catch (error) {
        this.#connection = false;
      }
    };
    checking();
    setInterval(checking, 3000);
  }

  itsConnected() {
    if (!this.#connection) {
      throw new ConnectionError();
    }
    return true;
  }

  async namespaces() {
    this.itsConnected();
    const cmd =
      'kubectl get namespaces -o=jsonpath="{.items[*][metadata.name]}"';
    const response = await this.#execService.run(cmd);
    if (response.stderr) {
      throw new Error(response.stderr);
    }
    return response.stdout.split(' ');
  }

  async pods(namespace) {
    this.itsConnected();

    let cmd = 'kubectl get pods';

    cmd += namespace ? ` -n ${namespace}` : ' -A';

    const content = ` -o=jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.phase}{"\n"}{end}'`;

    cmd += content;
    const response = await this.#execService.run(cmd);
    if (response.stderr) {
      throw new Error(response.stderr);
    }
    return response.stdout.split(' ');
  }
}
