import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
// parse body into json
import bodyParser from 'body-parser';
import axios from 'axios';
// import moment.js
import moment from 'moment';
const { TextAnalysisClient, AzureKeyCredential } = require("@azure/ai-language-text");

dotenv.config();

// Create a client to call Azure Text Analytics for Health
const textAnalysisClient = new TextAnalysisClient(process.env.AZURE_TEXT_ANALYTICS_FOR_HEALTH_URL, 
                                                  new AzureKeyCredential(process.env.AZURE_TEXT_ANALYTICS_FOR_HEALTH_KEY));

const app: Express = express();
// parse query string parameters
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

app.get('/logo.png', (req, res) => {
  res.setHeader('Content-Type', 'image/png');
  res.sendFile('logo.png', { root: __dirname });
});

app.post('/clinicaltrials/:patientId', async (req: Request, res: Response) => {
  const patientId = req.params.patientId;
  const body = req.body;
  console.log(`[server]: body: ${JSON.stringify(body)}`);

  if (body.targetTreatment === undefined) {
    res.status(400).send({ message: 'Missing required targetTreatment' });
    return;
  }

  if (body.conditions === undefined) {
    res.status(400).send({ message: 'Missing required fields' });
    return;
  }

  // call using Axios for Azure Health Insights
  const baseUrl = process.env.AZURE_HEALTH_INSIGHTS_URL;

  const url = `${baseUrl}/healthinsights/trialmatcher/jobs?api-version=2023-03-01-preview`
  

  // Look for the condition in TA4H and get the UMLS code
  const documents = [body.conditions];
  const actions = [
    {
      kind: "Healthcare",
    },
  ];
  
  const clinicalInfos = [];
  
  const poller = await textAnalysisClient.beginAnalyzeBatch(actions, documents, "en");
  const results = await poller.pollUntilDone();
  let  tah_result = "";
  for await (const actionResult of results) {
    if (actionResult.kind !== "Healthcare") {
      throw new Error(`Expected a healthcare results but got: ${actionResult.kind}`);
    }
    for (const result of actionResult.results) {      
      tah_result = result.entities[0].dataSources[0].entityId;
      clinicalInfos.push({
        system: "http://www.nlm.nih.gov/research/umls",
        code: tah_result,
        name: body.conditions,
        value: "true"
      });
    }
  }
  
  // Create a JSON payload

  // calculate the birth date from age in years use moment.js
  const birthDate = moment().subtract(body.age, 'years').format('YYYY-MM-DD');

  const payload = {
    configuration: {clinicalTrials:
      {
        registryFilters: [{
            conditions: [
               body.targetTreatment
            ],
            phases: [
               "phase2",
               "phase3"
            ],
            sources: [
               "clinicaltrials.gov"
            ],
            facilityLocations: [
               {
                  "countryOrRegion": "United States",
                  "city": body.location || "Birmingham",
                  "state": "AL"
               }
            ]
        }]
      },
      verbose: true,
      includeEvidence: true
    },
    patients: [
      {
         id: patientId,
         info: {
            sex: body.gender,
            birthDate: birthDate,
            clinicalInfo: clinicalInfos             
         }
      }
   ]
  }

  try {
    const ahi_resposne = await axios.post(url, payload, 
      {
        headers: {
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': process.env.AZURE_HEALTH_INSIGHTS_KEY
        }  
      });
      const location = ahi_resposne.headers['operation-location'];
      console.log(`[server]: ahi_resposne: ${location}`);
      let done = false;
      let tries = 0;
      let jobResponse;
      while (!done && tries < 10) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        jobResponse = await axios.get(location, {headers: {'Ocp-Apim-Subscription-Key': process.env.AZURE_HEALTH_INSIGHTS_KEY}});
        if (jobResponse.data.status === 'succeeded') {
          done = true;
          continue;
        }
        tries++;
      }
      // take 5 first trials
      if (jobResponse) {
        // filter out only eligible trials
        const eligible = jobResponse.data.results.patients[0].inferences.filter((el: any) => el.value === "Eligible"); 
        const trials = eligible.slice(0, 5);
        const output = trials.map((trial: any) => { 
          return {id: trial.id, description: trial.description};
        });
        res.send(output);
      }
  }
  catch (error) {
    console.log(`[server]: error: ${error}`);
    res.status(400);
    res.send(error);
  }
});

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});

export default app;