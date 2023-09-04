export class K8SError extends Error {}

export class ConnectionError extends K8SError {
  constructor() {
    super('Could not connect to to k8s cluster');
  }
}
