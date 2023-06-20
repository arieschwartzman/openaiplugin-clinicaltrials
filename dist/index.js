"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
// parse body into json
const body_parser_1 = __importDefault(require("body-parser"));
// pare query string parameters
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use(body_parser_1.default.json());
const port = process.env.PORT;
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
app.post('/clinicaltrials/:patientId', (req, res) => {
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
//# sourceMappingURL=index.js.map