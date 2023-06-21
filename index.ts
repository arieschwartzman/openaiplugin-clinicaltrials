import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
// parse body into json
import bodyParser from 'body-parser';
import axios from 'axios';
// import moment.js
import moment from 'moment';

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

app.get('/logo.png', (req, res) => {
  res.setHeader('Content-Type', 'image/png');
  res.sendFile('logo.png', { root: __dirname });
});

app.post('/clinicaltrials/:patientId', async (req: Request, res: Response) => {
  const patientId = req.params.patientId;
  const body = req.body;
  console.log(`[server]: body: ${JSON.stringify(body)}`);

  // call using Axios for Azure Health Insights
  const baseUrl = process.env.AZURE_HEALTH_INSIGHTS_URL;

  const url = `${baseUrl}/healthinsights/trialmatcher/jobs?api-version=2023-03-01-preview`
  
  // Create a JSON payload

  // calculate the birth date from age in years use moment.js
  const birthDate = moment().subtract(body.age, 'years').format('YYYY-MM-DD');

  const payload = {
    configuration: {clinicalTrials:
      {
        registryFilters: [{
            conditions: [
               body.query
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
            clinicalInfo: [
               {
                  system: "http://www.nlm.nih.gov/research/umls",
                  code: "C0012544",
                  name: "Biphosphonates",
                  value: "true"
               }               
            ]
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