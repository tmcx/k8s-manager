import express from 'express';
import { K8SService } from './services/k8s/k8s.js';

const app = express();

const config = {
  port: '8088',
  host: '0.0.0.0'
};

const k8s = new K8SService();

async function manageResponse(data) {
  try {
    const response = await data;
    return { data: response };
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
  }
}

app.get('/namespaces', (_, res) => {
  manageResponse(k8s.namespaces()).then((response) => {
    res.json(response);
  });
});

app.get('/pods', (_, res) => {
  manageResponse(k8s.pods()).then((response) => {
    res.json(response);
  });
});

app.listen(config.port, config.host, () => {
  console.log(`Listening on port ${config.port}`);
});
