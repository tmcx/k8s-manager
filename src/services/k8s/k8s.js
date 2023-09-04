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
    const cmd = `kubectl get namespaces -o=jsonpath="{.items[*]['metadata.name']}"`;
    const response = await this.#execService.run(cmd);
    if (response.stderr) {
      throw new Error(response.stderr);
    }
    return response.stdout.split(' ');
  }

  async pods({ namespace }) {
    this.itsConnected();

    let cmd = 'kubectl get pods';

    cmd += namespace ? ` -n ${namespace}` : ' -A';

    const content = ` -o=jsonpath='{range .items[*]}{.metadata.name}{"|--|"}{.status.startTime}{"|--|"}{.status.phase}{"|--|"}{.metadata.namespace}{"|||"}{end}'`;

    cmd += content;
    const response = await this.#execService.run(cmd);
    if (response.stderr) {
      throw new Error(response.stderr);
    }
    return response.stdout
      .split('|||')
      .map((line) => {
        const [name, startTime, status, namespace] = line.split('|--|');

        return { name, startTime, status, namespace };
      })
      .slice(0, -1);
  }

  async logs({ pod, container, namespace }) {
    this.itsConnected();

    let cmd = 'kubectl get logs ';

    namespace = namespace ? ` -n ${namespace}` : ' -A';
    const pods = pod ? [{ name: pod, namespace }] : await this.pods(namespace);
    container = container ? `-c ${container}` : '--all-containers';

    const logPromises = [];
    for (const pod of pods) {
      cmd += `pods/${pod.name} ${container} ${pod.namespace} --timestamp --ignore-errors`;
      logPromises.push(this.#execService.run(cmd));
    }

    return Promise.allSettled(logPromises);
  }
}
