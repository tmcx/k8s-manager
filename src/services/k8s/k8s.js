import { ExecService } from '../exec/exec.js';
import { ConnectionError, MissingParam } from './errors.js';

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
    setInterval(checking, 20000);
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

  async pods({ namespace, describe, deployment, pod }) {
    this.itsConnected();

    let cmd = 'kubectl get pods';

    if (pod) {
      if (!namespace) {
        throw new MissingParam('namespace');
      }
      cmd += `/${pod} `;
    }

    if (deployment) {
      cmd += ` -l=app=${deployment} `;
    }

    cmd += namespace ? ` -n ${namespace}` : ' -A';
    const fieldDelimiter = '|--|';
    const lineDelimiter = '|||';

    const fields = [
      '{.metadata.name}',
      '{.status.startTime}',
      '{.status.phase}',
      '{.metadata.namespace}',
    ];

    if (describe) {
      fields.push('{.metadata.labels}');
      fields.push('{.spec}');
    }

    const commandFields = fields.join(`{"${fieldDelimiter}"}`);

    const requiredContent = `${commandFields}{"${lineDelimiter}"}`;
    const content = ` -o=jsonpath='${
      pod ? requiredContent : `{range .items[*]}${requiredContent}{end}`
    }'`;

    cmd += content;
    const response = await this.#execService.run(cmd);
    if (response.stderr) {
      throw new Error(response.stderr);
    }
    return response.stdout
      .split('|||')
      .slice(0, -1)
      .map((line) => {
        const [name, startTime, status, namespace, labels, spec] =
          line.split(fieldDelimiter);
        let output = { name, startTime, status, namespace };
        if (describe) {
          const { containers } = JSON.parse(spec);

          const describeContent = {
            labels: JSON.parse(labels),
            containers: containers.map(
              ({ name, env, image, imagePullPolicy }) => ({
                name,
                env,
                image,
                imagePullPolicy,
              })
            ),
          };

          output = { ...output, describe: describeContent };
        }
        return output;
      });
  }

  async logs({ pod, container, namespace, tail, search, deployment, since }) {
    this.itsConnected();

    container = container ? `-c ${container}` : '--all-containers';

    const requiredTail = Number(tail);
    tail = tail ? `--tail=${requiredTail}` : '';

    let grep = `| grep -v '^.\\{0,31\\}$' | grep -E '.{32,}'`;
    if (search) {
      grep += ` | grep -is "${search}"`;
    }

    since = since ? `--since=${since}` : '';

    const pods = pod
      ? [{ name: pod, namespace }]
      : await this.pods({ namespace, deployment });

    const mb = 1024 * 1024;
    const allLogs = {};
    for (const pod of pods) {
      const cmd = `kubectl logs pods/${pod.name} -n ${pod.namespace} ${container} ${tail} --timestamps --ignore-errors ${grep}`;
      const { stdout } = await this.#execService.run(cmd);
      const logs = stdout.split('\n').filter((log) => log !== '');
      if (!allLogs[pod.namespace]) {
        allLogs[pod.namespace] = {};
      }
      allLogs[pod.namespace][pod.name] = logs;
      console.log(
        'Logs size:',
        Math.round(
          (Buffer.byteLength(JSON.stringify(allLogs), 'utf8') / mb) * 100
        ) / 100,
        'mb'
      );
    }

    return allLogs;
  }
}
