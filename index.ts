import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
// parse body into json
import bodyParser from 'body-parser';
// pare query string parameters


dotenv.config();

const app: Express = express();
app.use(bodyParser.json());

const port = process.env.PORT || 5003;

app.get('/', (req, res) => {
  res.send('Express + TypeScript Server');
});

// Serve local file ai-plugin.json as apllication/json
app.get('/.well-known/ai-plugin.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.sendFile('./.well-known/ai-plugin.json', { root: __dirname });
});

// Server local file openapi.yaml as apllication/json
app.get('/openapi.yaml', (req, res) => {
  res.setHeader('Content-Type', 'text/yaml');
  res.sendFile('openapi.yaml', { root: __dirname });
});

app.post('/clinicaltrials/:patientId', (req: Request, res: Response) => {
  const patientId = req.params.patientId;
  const body = req.body;
  console.log(`[server]: patientId: ${patientId}`);
  const response = [
    "Trial 1",
    "Trial 2",
    "Trial 3"
  ];
  res.send(response);
});

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});